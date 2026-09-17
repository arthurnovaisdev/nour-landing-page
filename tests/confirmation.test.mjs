import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID, generateKeyPairSync, sign } from "node:crypto";
import { testDatabase, testEnv, context, request, gatewayResponse } from "./checkout-fixtures.mjs";
import { PaymentRepository, eligible } from "../server/payments/payment-repository.mjs";
import { createHandlers } from "../server/payments/checkout.mjs";
import { createPaymentHandlers, publicStatus } from "../server/payments/confirmation.mjs";
import { configuration, hash } from "../server/payments/input.mjs";
import { reconcile, createReadApi, createNotificationVerifier } from "../server/payments/reconciliation.mjs";

const token = "test-only-gateway-credential";
const checkoutId = "CHEC_5fc1c0dd-1436-4d5b-bc40-2eb57f74d2d9";
const providerOrderId = "ORDE_11111111-2222-4333-8444-555555555555";
const chargeId = "CHAR_22222222-2222-4333-8444-555555555555";
const cbId = "CBKS_33333333-2222-4333-8444-555555555555";
const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const publicKey = keys.publicKey.export({ type: "spki", format: "der" }).toString("base64");
async function fixture() {
  const { db, pool } = await testDatabase();
  let now = Date.now();
  const repo = new PaymentRepository(pool, () => new Date(now));
  const env = { ...testEnv, PAGBANK_API_TOKEN: token };
  const f = { db, repo, env, status: "WAITING", checkoutStatus: "ACTIVE", refunded: 0, captured: false,
    calls: [], corrupt: null, fail: false, advance(ms) { now += ms; }, close: () => db.close() };
  const fetcher = async (url, options) => {
    f.calls.push({ url, method: options.method });
    assert.equal(options.redirect, "error");
    assert.equal(new URL(url).origin, "https://sandbox.api.pagseguro.com");
    if (options.method === "POST") return gatewayResponse(JSON.parse(options.body));
    assert.equal(options.method, "GET");
    if (f.fail) throw Error("sensitive-upstream-error");
    if (url.includes("public-keys")) return Response.json({ public_key: publicKey });
    let result;
    if (url.includes("/checkouts/")) result = { id: checkoutId, reference_id: f.order.id,
      status: f.checkoutStatus, items: [{ reference_id: "mensal", quantity: 1, unit_amount: 10000 }],
      orders: f.empty ? [] : [{ id: providerOrderId }] };
    else if (url.includes("/orders/")) result = { id: providerOrderId, reference_id: f.order.id,
      items: [{ reference_id: "mensal", quantity: 1, unit_amount: 10000 }],
      charges: [{ id: chargeId, status: f.status, paid_at: new Date(now - 1000).toISOString(),
        amount: { value: 10000, currency: "BRL", summary: { total: 10000,
          paid: f.status === "PAID" || f.captured ? 10000 : 0, refunded: f.refunded } } }] };
    else if (url.includes("/chargebacks/")) result = { id: cbId, status: "AWAITING_EVIDENCE",
      amount: { value: 10000, currency: "BRL" }, transaction: { reference_id: f.order.id, amount: 10000 } };
    else throw Error("UNEXPECTED_MOCK_PATH");
    if (f.corrupt) f.corrupt(result, url);
    return Response.json(result);
  };
  const deps = { env: () => env, getRepository: async () => repo, fetcher };
  const checkout = createHandlers(deps);
  f.handlers = createPaymentHandlers(deps);
  const session = await checkout.session(request("/api/checkout-session"), context);
  f.cookie = session.headers.get("set-cookie").split(";")[0];
  assert.equal((await checkout.checkout(request("/api/checkouts", { planId: "mensal" }, { cookie: f.cookie, key: randomUUID() }), context)).status, 201);
  f.order = (await db.query("SELECT * FROM nour_orders")).rows[0];
  f.get = async () => (await db.query("SELECT * FROM nour_orders WHERE id=$1", [f.order.id])).rows[0];
  f.payload = () => ({ id: providerOrderId, reference_id: f.order.id, charges: [{ id: chargeId, status: f.status }] });
  f.webhook = async (payload = f.payload(), headers = {}) => {
    const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
    const signature = createHash("sha256").update(token + "-").update(raw).digest("hex");
    return f.handlers.webhook(new Request(testEnv.SITE_ORIGIN + "/api/webhooks/pagbank", {
      method: "POST", headers: { "Content-Type": "application/json", "x-authenticity-token": signature, ...headers }, body: raw,
    }), context);
  };
  f.worker = () => f.handlers.worker();
  f.query = (patch = {}) => f.handlers.status(request("/api/orders/status", {}, { method: "GET", cookie: f.cookie, ...patch }), context);
  return f;
}

test("todos os estados financeiros são reconciliados via API; só PAID é elegível", async () => {
  for (const [status, checkoutStatus, expected] of [["WAITING","ACTIVE","WAITING"],["IN_ANALYSIS","ACTIVE","IN_ANALYSIS"],
    ["AUTHORIZED","ACTIVE","IN_ANALYSIS"],["PAID","ACTIVE","PAID"],["DECLINED","ACTIVE","DECLINED"],
    ["CANCELED","ACTIVE","CANCELED"],["CANCELED","EXPIRED","EXPIRED"]]) {
    const f = await fixture();
    try {
      f.status = status; f.checkoutStatus = checkoutStatus;
      assert.equal((await f.webhook()).status, 204);
      assert.equal((await f.get()).status, "PENDING");
      await f.worker();
      const order = await f.get();
      assert.equal(order.status, expected);
      assert.equal(order.reconciliation_pending, false);
      assert.equal(eligible(order, f.repo.clock()), expected === "PAID");
      assert.equal(publicStatus(order, f.repo.clock()).state, expected);
      const result = await f.query();
      assert.equal(result.status, 200);
      const data = await result.json();
      assert.deepEqual(Object.keys(data).sort(), ["access","canRetry","mode","state"]);
      assert.equal(data.access, "BLOCKED");
      assert.equal(data.canRetry, ["DECLINED","CANCELED","EXPIRED"].includes(expected));
      const vip = (await f.db.query("SELECT * FROM nour_vip_access")).rows;
      assert(vip.every(v => v.state === "WAITING_MANUAL"));
    } finally { await f.close(); }
  }
});

test("assinatura inválida, origem, formato, tamanho e identificadores não alteram pedidos", async () => {
  const f = await fixture();
  try {
    const cases = [
      [f.payload(), { "x-authenticity-token": "0".repeat(64) }, 401],
      [f.payload(), { Origin: testEnv.SITE_ORIGIN }, 403],
      [f.payload(), { "Content-Type": "text/plain" }, 415],
      [f.payload(), { "Content-Encoding": "gzip" }, 415],
      [" ".repeat(65537), {}, 413], ["{broken}", {}, 400], ["[]", {}, 400],
      [{ ...f.payload(), reference_id: "NOUR-PUBLIC" }, {}, 400],
      [{ ...f.payload(), id: "ORDE_../../evil" }, {}, 400],
      [{ ...f.payload(), charges: [{ id: "bad" }] }, {}, 400],
      [f.payload(), { "x-product-origin": "CHECKOUT", "x-product-id": "CHEC_00000000-2222-4333-8444-555555555555" }, 400],
      [{ ...f.payload(), reference_id: randomUUID() }, {}, 503],
    ];
    for (const [body, headers, code] of cases) assert.equal((await f.webhook(body, headers)).status, code);
    assert.equal((await f.db.query("SELECT count(*)::int n FROM nour_payment_events")).rows[0].n, 0);
    assert.equal((await f.get()).status, "PENDING");
  } finally { await f.close(); }
});

test("deduplicação concorrente e persistência independente de instância", async () => {
  const f = await fixture();
  try {
    f.status = "PAID";
    const results = await Promise.all(Array.from({ length: 8 }, () => f.webhook()));
    assert(results.every(r => r.status === 204));
    assert.equal((await f.db.query("SELECT count(*)::int n FROM nour_payment_events")).rows[0].n, 1);
    assert.equal((await f.db.query("SELECT count(*)::int n FROM nour_jobs WHERE kind='RECONCILE'")).rows[0].n, 1);
    await f.worker();
    const before = (await f.get()).version;
    await f.webhook(); await f.worker();
    assert.equal((await f.get()).version, before);
    assert.equal((await f.db.query("SELECT count(*)::int n FROM nour_vip_access")).rows[0].n, 1);
  } finally { await f.close(); }
});

test("dados do webhook não são prova: PAID falso, evento antigo e falha transitória", async () => {
  const f = await fixture();
  try {
    await f.webhook({ ...f.payload(), status: "PAID", amount: 1 }); await f.worker();
    assert.equal((await f.get()).status, "WAITING");
    f.status = "PAID"; await f.webhook(); await f.worker();
    assert.equal((await f.get()).status, "PAID");
    await f.webhook({ ...f.payload(), status: "WAITING", extra: 1 }); await f.worker();
    assert.equal((await f.get()).status, "PAID");
    f.fail = true; await f.webhook({ ...f.payload(), extra: 2 }); await f.worker();
    assert.equal(publicStatus(await f.get(), f.repo.clock()).state, "TEMPORARY_ERROR");
    f.fail = false; f.advance(11000); await f.worker();
    assert.equal(publicStatus(await f.get(), f.repo.clock()).state, "PAID");
  } finally { await f.close(); }
});

test("valor, moeda, vínculo, envelope incompleto e múltiplas capturas falham fechados", async () => {
  const f = await fixture();
  try {
    f.status = "PAID";
    for (const corrupt of [
      d => { if (d.charges) d.charges[0].amount.value = 1; },
      d => { if (d.charges) d.charges[0].amount.currency = "USD"; },
      d => { d.reference_id = randomUUID(); },
      d => { if (d.orders) delete d.orders; },
      d => { if (d.charges) d.charges.push({ ...d.charges[0], id: "CHAR_33333333-2222-4333-8444-555555555555" }); },
      d => { if (d.charges) d.charges[0].status = "UNKNOWN"; },
      d => { if (d.charges) delete d.charges[0].amount.summary.refunded; },
      d => { if (d.charges) d.charges[0].paid_at = "invalid"; },
    ]) {
      const api = createReadApi(configuration(f.env), async url => {
        const d = url.includes("/checkouts/") ? { id: checkoutId, reference_id: f.order.id, status: "ACTIVE",
          items: [{ reference_id: "mensal", quantity: 1, unit_amount: 10000 }], orders: [{ id: providerOrderId }] }
          : { id: providerOrderId, reference_id: f.order.id, items: [{ reference_id: "mensal", quantity: 1, unit_amount: 10000 }],
            charges: [{ id: chargeId, status: "PAID", paid_at: new Date(Date.now()-1000).toISOString(),
              amount: { value: 10000, currency: "BRL", summary: { total: 10000, paid: 10000, refunded: 0 } } }] };
        corrupt(d); return Response.json(d);
      });
      await assert.rejects(reconcile(f.order, { orders: [], chargebacks: [] }, api), /RECONCILIATION_MISMATCH/);
    }
  } finally { await f.close(); }
});

test("estorno parcial/integral suspende VIP e deduplica tarefa manual de remoção", async () => {
  for (const refunded of [100,10000]) {
    const f = await fixture();
    try {
      f.status = "PAID"; await f.webhook(); await f.worker();
      await f.db.query("UPDATE nour_vip_access SET state='ACTIVE',granted_at=now(),expires_at=now()+interval '1 month',granted_by='TEST' WHERE order_id=$1", [f.order.id]);
      f.refunded = refunded;
      await f.webhook({ ...f.payload(), refund_notice: true }); await f.worker();
      const order = await f.get();
      assert.equal(order.status, refunded === 10000 ? "REFUNDED" : "PAID");
      assert.equal(eligible(order, f.repo.clock()), false);
      assert.equal((await f.db.query("SELECT state FROM nour_vip_access")).rows[0].state, "SUSPENDED");
      assert.equal((await f.db.query("SELECT count(*)::int n FROM nour_jobs WHERE kind='MANUAL_REMOVE'")).rows[0].n, 1);
    } finally { await f.close(); }
  }
});

test("chargeback ECDSA consulta API, bloqueia e jamais reativa automaticamente", async () => {
  const f = await fixture();
  try {
    f.status = "PAID"; await f.webhook(); await f.worker();
    const body = JSON.stringify({ id: cbId, transaction: { reference_id: f.order.id } });
    const signature = sign("sha256", Buffer.from(body), keys.privateKey).toString("base64");
    const event = () => new Request(testEnv.SITE_ORIGIN + "/api/webhooks/pagbank", { method: "POST", body,
      headers: { "Content-Type": "application/json", "x-payload-signature": "bad, " + signature } });
    assert.equal((await f.handlers.webhook(event(), context)).status, 204);
    assert.equal(eligible(await f.get(), f.repo.clock()), false);
    await f.worker();
    assert.equal((await f.get()).status, "CHARGEBACK");
    assert.equal(publicStatus(await f.get(), f.repo.clock()).state, "BLOCKED");
    assert.equal((await f.webhook(JSON.parse(body))).status, 401);
    f.advance(61000); await f.repo.enqueue(f.order.id); await f.worker();
    assert.equal((await f.get()).status, "CHARGEBACK");
  } finally { await f.close(); }
});

test("sessão opaca, expiração, CSRF, código público e consulta mínima", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.query({ cookie: undefined })).status, 401);
    assert.equal((await f.query({ cookie: "__Host-nour-order=" + f.order.public_code })).status, 401);
    assert.equal((await f.query({ headers: { Origin: "https://evil.test" } })).status, 403);
    const url = new Request(testEnv.SITE_ORIGIN + "/api/orders/status?status=PAID", { headers: { Cookie: f.cookie } });
    assert.equal((await f.handlers.status(url, context)).status, 403);
    const result = await f.query();
    assert.equal(result.headers.get("Cache-Control"), "no-store");
    assert.equal(result.headers.get("Access-Control-Allow-Origin"), null);
    const data = await result.text();
    assert(!data.includes(f.order.id) && !data.includes(f.order.public_code) && !data.includes(token));
    f.advance(86400001);
    assert.equal((await f.query()).status, 401);
  } finally { await f.close(); }
});

test("falha de persistência não confirma recebimento; fila esgotada gera revisão", async () => {
  const f = await fixture();
  try {
    const ingest = f.repo.ingest;
    f.repo.ingest = () => { throw Error("database-secret"); };
    const failed = await f.webhook();
    assert.equal(failed.status, 503); assert(!(await failed.text()).includes("secret"));
    f.repo.ingest = ingest;
    f.fail = true; assert.equal((await f.webhook()).status, 204);
    for (let i=0;i<5;i++) { await f.worker(); f.advance(310000); }
    const jobs = (await f.db.query("SELECT * FROM nour_jobs WHERE kind='RECONCILE'")).rows;
    assert.equal(jobs.length, 1); assert.equal(jobs[0].state, "DEAD");
    assert.equal((await f.get()).review_required, true);
    assert.equal((await f.db.query("SELECT count(*)::int n FROM nour_jobs WHERE kind='MANUAL_REVIEW'")).rows[0].n, 1);
  } finally { await f.close(); }
});

test("lease expirado e resposta concorrente não sobrescrevem decisão mais nova", async () => {
  const f = await fixture();
  try {
    await f.webhook(); const old = await f.repo.claim();
    f.advance(91000); const fresh = await f.repo.claim();
    await f.repo.finish(old, undefined, "PROVIDER_UNAVAILABLE");
    assert.equal((await f.db.query("SELECT lease_token FROM nour_jobs WHERE kind='RECONCILE'")).rows[0].lease_token, fresh.leaseToken);
    await f.webhook({ ...f.payload(), newer: true });
    await f.repo.finish(fresh, { status: "PAID" });
    assert.equal((await f.get()).status, "PENDING");
    assert.equal((await f.db.query("SELECT last_error_code FROM nour_jobs WHERE id=$1", [fresh.id])).rows[0].last_error_code, "CONCURRENT_UPDATE");
  } finally { await f.close(); }
});

test("nova tentativa segura reutiliza checkout; vencido libera nova escolha sem cobrar", async () => {
  for (const status of ["DECLINED","CANCELED","EXPIRED"]) {
    const f = await fixture();
    try {
      f.status = status === "EXPIRED" ? "CANCELED" : status;
      f.checkoutStatus = status === "EXPIRED" ? "EXPIRED" : "ACTIVE";
      await f.webhook(); await f.worker();
      const response = await f.handlers.retry(request("/api/orders/retry", {}, { cookie: f.cookie }), context);
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal(data.checkoutUrl === null, status === "EXPIRED");
      assert.equal(f.calls.filter(c => c.method === "POST").length, 1);
      if (status === "EXPIRED") {
        assert.equal((await f.get()).superseded, true);
        assert.equal((await f.query()).status, 401);
      }
    } finally { await f.close(); }
  }
});

test("PAID, análise, espera, erro e sessão de outro comprador impedem retry", async () => {
  const f = await fixture();
  try {
    for (const status of ["WAITING","IN_ANALYSIS","PAID"]) {
      f.status = status; await f.webhook(); await f.worker();
      assert.equal((await f.handlers.retry(request("/api/orders/retry", {}, { cookie: f.cookie }), context)).status, 409);
    }
    assert.equal((await f.query({ cookie: "__Host-nour-order=" + "a".repeat(64) })).status, 401);
  } finally { await f.close(); }
});

test("ECDSA bytes originais, múltiplas assinaturas e rotação de chave por TTL", async () => {
  const verify = createNotificationVerifier();
  const raw = Buffer.from('{"texto":"ação"}');
  const signature = sign("sha256", raw, keys.privateKey).toString("base64");
  const headers = new Headers({ "x-payload-signature": "invalid, " + signature });
  const config = configuration({ ...testEnv, PAGBANK_API_TOKEN: token });
  assert.equal(await verify(raw, headers, config, async () => ({ public_key: publicKey })), "NOTIFICATION_ECDSA");
  await assert.rejects(verify(Buffer.from(raw + " "), headers, config, async () => assert.fail()), /INVALID_SIGNATURE/);
  await assert.rejects(verify(raw, new Headers(), config, async () => assert.fail()), /INVALID_SIGNATURE/);
});

// Regressões de parsers e paginação: nenhuma ausência deve virar captura positiva.
test("JSON duplicado, BOM e UTF-8 inválido são rejeitados com assinatura válida", async () => {
  const f = await fixture();
  try {
    const payload = JSON.stringify(f.payload());
    assert.equal((await f.webhook(payload.replace('"reference_id":', '"reference_id":"ignorar","reference_id":'))).status, 400);
    assert.equal((await f.webhook("\uFEFF" + payload)).status, 400);
    const raw = Buffer.from([0xc3,0x28]);
    const signature = createHash("sha256").update(token + "-").update(raw).digest("hex");
    const result = await f.handlers.webhook(new Request(testEnv.SITE_ORIGIN + "/api/webhooks/pagbank", {
      method: "POST", body: raw, headers: { "Content-Type": "application/json", "x-authenticity-token": signature },
    }), context);
    assert.equal(result.status, 400);
  } finally { await f.close(); }
});

test("paginação percorre a página seguinte e excesso vai para revisão", async () => {
  const f = await fixture();
  try {
    const offsets = [];
    await assert.rejects(reconcile(f.order, { orders: [], chargebacks: [] }, async path => {
      const offset = Number(new URL("https://sandbox.api.pagseguro.com" + path).searchParams.get("offset"));
      offsets.push(offset);
      return { id: checkoutId, reference_id: f.order.id, status: "ACTIVE",
        items: [{ reference_id: "mensal", quantity: 1, unit_amount: 10000 }],
        orders: offset === 0 ? Array.from({ length: 100 }, () => ({ id: "ORDE_" + randomUUID() })) : [] };
    }), /RECONCILIATION_MISMATCH/);
    assert.deepEqual(offsets, [0,100]);
  } finally { await f.close(); }
});

test("produção, ausência de token, HTTP e CSRF não abrem webhook ou retry", async () => {
  const f = await fixture();
  try {
    f.env.PAGBANK_ENVIRONMENT = "production";
    assert.equal((await f.webhook()).status, 503);
    f.env.PAGBANK_ENVIRONMENT = "sandbox"; delete f.env.PAGBANK_API_TOKEN;
    assert.equal((await f.webhook()).status, 503);
    f.env.PAGBANK_API_TOKEN = token;
    assert.equal((await f.handlers.retry(request("/api/orders/retry", {}, { cookie: f.cookie, headers: { Origin: "https://evil.test" } }), context)).status, 403);
    const req = new Request("http://nour.test/api/webhooks/pagbank", { method: "POST", body: "{}" });
    assert.equal((await f.handlers.webhook(req, context)).status, 403);
  } finally { await f.close(); }
});

test("estorno não é revertido por evento PAID e pagamento tardio exige revisão", async () => {
  const f = await fixture();
  try {
    f.checkoutStatus = "EXPIRED"; f.empty = true;
    await f.webhook({ id: checkoutId, reference_id: f.order.id, status: "EXPIRED" }); await f.worker();
    assert.equal((await f.get()).status, "EXPIRED");
    f.empty = false; f.status = "PAID";
    await f.webhook(); await f.worker();
    assert.equal((await f.get()).status, "PAID");
    assert.equal((await f.get()).review_required, true);
    f.refunded = 10000;
    await f.webhook({ ...f.payload(), update: 1 }); await f.worker();
    assert.equal((await f.get()).status, "REFUNDED");
    f.refunded = 0;
    await f.webhook({ ...f.payload(), update: 2 }); await f.worker();
    assert.equal((await f.get()).status, "REFUNDED");
    assert.equal(eligible(await f.get(), f.repo.clock()), false);
  } finally { await f.close(); }
});
