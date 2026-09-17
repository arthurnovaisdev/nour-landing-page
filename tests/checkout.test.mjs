import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture, session, request, context, gatewayResponse, configuration, testEnv } from "./checkout-fixtures.mjs";
import { createHandlers } from "../server/payments/checkout.mjs";
import { validPaymentUrl, SANDBOX_API } from "../server/payments/gateway.mjs";
import liveHandler from "../netlify/functions/create-checkout.mjs";

async function checkout(f, cookie, planId = "mensal", key = randomUUID(), ctx = context) {
  return f.handlers.checkout(request("/api/checkouts", { planId }, { cookie, key }), ctx);
}
test("criação Sandbox: planos fixos, PENDING durável antes da rede, referência e URLs confiáveis", async () => {
  for (const [plan, amount, months] of [["mensal",10000,1],["semestral",50000,6],["anual",80000,12]]) {
    const f = await fixture({ env: { PAGBANK_API_TOKEN: "test-only-gateway-credential" },
      fetcher: async (url, options) => {
        assert.equal(url, SANDBOX_API);
        assert.equal(options.redirect, "error");
        assert.equal(options.headers.Authorization, "Bearer test-only-gateway-credential");
        assert(!Object.hasOwn(options.headers, "x-idempotency-key"));
        const payload = JSON.parse(options.body);
        const { rows: [order] } = await f.db.query("SELECT * FROM nour_orders");
        const { rows: [attempt] } = await f.db.query("SELECT * FROM nour_checkout_attempts");
        assert.equal(order.status, "PENDING");
        assert.equal(attempt.state, "CREATING");
        assert.equal(payload.reference_id, order.id);
        assert.match(order.id, /^[a-f0-9-]{36}$/);
        assert.equal(order.duration_months, months);
        assert.equal(payload.items[0].unit_amount, amount);
        assert.equal(payload.items[0].name, order.plan_name);
        assert.equal(payload.items[0].description, order.plan_description);
        assert.equal(payload.items[0].quantity, 1);
        assert.equal(payload.customer_modifiable, true);
        assert(!Object.hasOwn(payload, "customer"));
        assert(!Object.hasOwn(payload, "recurrence_plan"));
        assert.equal(payload.redirect_url, testEnv.SITE_ORIGIN + "/checkout-return.html");
        assert.equal(payload.return_url, payload.redirect_url);
        assert.deepEqual(payload.notification_urls, [testEnv.SITE_ORIGIN + "/api/webhooks/pagbank"]);
        assert.deepEqual(payload.payment_notification_urls, payload.notification_urls);
        assert.equal(Date.parse(payload.expiration_date) - new Date(order.created_at).getTime(), 7200000);
        return gatewayResponse(payload);
      },
    });
    try {
      const cookie = await session(f);
      const result = await checkout(f, cookie, plan);
      assert.equal(result.status, 201);
      const data = await result.json();
      assert.equal(data.status, "PENDING");
      assert.equal(data.mode, "sandbox");
      assert.equal(validPaymentUrl(data.checkoutUrl), true);
      assert.match(data.code, /^NOUR-[A-F0-9]{24}$/);
      const { rows: [order] } = await f.db.query("SELECT * FROM nour_orders");
      assert.equal(order.checkout_url, data.checkoutUrl);
      assert.equal(order.checkout_id, "CHEC_5fc1c0dd-1436-4d5b-bc40-2eb57f74d2d9");
      assert.equal(order.status, "PENDING");
      const text = JSON.stringify(data);
      assert(!text.includes(order.id));
      assert(!text.includes("credential"));
    } finally { await f.close(); }
  }
});

test("plano inválido, adulteração de preço e JSON extra/duplicado não chegam ao gateway", async () => {
  const f = await fixture();
  try {
    const cookie = await session(f);
    for (const body of [
      { planId: "premium" }, { planId: "__proto__" }, { planId: "constructor" },
      { planId: "mensal", amount: 1 }, { planId: "mensal", return_url: "https://evil.test" },
      { planId: "mensal", customer: {} }, { planId: [] }, [],
      '{"planId":"anual","planId":"mensal"}', '{"planId":', "null",
    ]) {
      const res = await f.handlers.checkout(request("/api/checkouts", body, { cookie, key: randomUUID() }), context);
      assert.equal(res.status, 400);
    }
    assert.equal(f.calls, 0);
    assert.equal((await f.db.query("SELECT count(*)::int AS n FROM nour_orders")).rows[0].n, 0);
  } finally { await f.close(); }
});

test("repetição com mesma chave ou outra chave reutiliza um pedido e um único checkout", async () => {
  const f = await fixture({ env: { PAGBANK_API_TOKEN: "test-only-gateway-credential" },
    fetcher: async (_, options) => gatewayResponse(JSON.parse(options.body)) });
  try {
    const cookie = await session(f);
    const key = randomUUID();
    const first = await (await checkout(f, cookie, "mensal", key)).json();
    for (const nextKey of [key, randomUUID()]) {
      const res = await checkout(f, cookie, "mensal", nextKey);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), first);
    }
    assert.equal((await checkout(f, cookie, "anual", key)).status, 409);
    assert.equal(f.calls, 1);
    assert.equal((await f.db.query("SELECT count(*)::int AS n FROM nour_orders")).rows[0].n, 1);
  } finally { await f.close(); }
});

test("chamadas concorrentes: segunda recebe 202 enquanto apenas uma invoca o gateway", async () => {
  let release, entered;
  const reached = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const f = await fixture({ env: { PAGBANK_API_TOKEN: "test-only-gateway-credential" },
    fetcher: async (_, options) => { entered(); await gate; return gatewayResponse(JSON.parse(options.body)); } });
  try {
    const cookie = await session(f);
    const first = checkout(f, cookie);
    await reached;
    const repeated = await checkout(f, cookie);
    assert.equal(repeated.status, 202);
    assert.equal((await repeated.json()).error, "CHECKOUT_IN_PROGRESS");
    release();
    assert.equal((await first).status, 201);
    assert.equal(f.calls, 1);
  } finally { release(); await f.close(); }
});

test("rejeição definitiva do gateway permite retry limitado no mesmo pedido", async () => {
  let count = 0;
  const f = await fixture({ env: { PAGBANK_API_TOKEN: "test-only-gateway-credential" },
    fetcher: async (_, options) => ++count === 1
      ? Response.json({ sensitive: "must-not-leak" }, { status: 400 }) : gatewayResponse(JSON.parse(options.body)) });
  try {
    const cookie = await session(f);
    const rejected = await checkout(f, cookie);
    assert.equal(rejected.status, 502);
    assert.deepEqual(await rejected.json(), { error: "GATEWAY_REJECTED" });
    const id = (await f.db.query("SELECT id FROM nour_orders")).rows[0].id;
    assert.equal((await checkout(f, cookie)).status, 429);
    f.advance(11000);
    assert.equal((await checkout(f, cookie)).status, 201);
    assert.equal((await f.db.query("SELECT id FROM nour_orders")).rows[0].id, id);
    assert.equal(f.calls, 2);
  } finally { await f.close(); }
});

test("5xx, timeout e resposta inválida viram UNKNOWN; retry nunca cria novamente", async () => {
  for (const kind of ["500", "timeout", "unsafe-link", "wrong-reference", "wrong-amount", "malformed", "oversize", "redirect"]) {
    const f = await fixture({ env: { PAGBANK_API_TOKEN: "test-only-gateway-credential" },
      fetcher: async (_, options) => {
        const payload = JSON.parse(options.body);
        if (kind === "wrong-amount") return gatewayResponse(payload, { items: [{ ...payload.items[0], unit_amount: 1 }] });
        if (kind === "timeout") throw Error("sensitive-token-never-log");
        if (kind === "500") return Response.json({ sensitive: true }, { status: 500 });
        if (kind === "redirect") return new Response(null, { status: 302, headers: { Location: "https://evil.test" } });
        if (kind === "malformed") return new Response("broken", { headers: { "Content-Type": "application/json" } });
        if (kind === "oversize") return Response.json({ padding: "a".repeat(65537) });
        if (kind === "unsafe-link") return gatewayResponse(payload, { links: [{ rel: "PAY", method: "GET", href: "https://pagamento.pagseguro.uol.com.br/pagamento?code=production" }] });
        return gatewayResponse(payload, { reference_id: randomUUID() });
      } });
    try {
      const cookie = await session(f);
      assert.equal((await checkout(f, cookie)).status, 202, kind);
      f.advance(61000);
      assert.equal((await checkout(f, cookie)).status, 202, kind);
      assert.equal(f.calls, 1, kind);
      assert.equal((await f.db.query("SELECT state FROM nour_checkout_attempts")).rows[0].state, "UNKNOWN");
      assert.equal((await f.db.query("SELECT count(*)::int AS n FROM nour_jobs")).rows[0].n, 1);
      assert.equal((await f.db.query("SELECT review_required FROM nour_orders")).rows[0].review_required, true);
    } finally { await f.close(); }
  }
});

test("falha de persistência antes do gateway não cria checkout", async () => {
  const f = await fixture();
  try {
    const cookie = await session(f);
    f.repository.reserve = async () => { throw Error("postgres://sensitive"); };
    const res = await checkout(f, cookie);
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: "SERVICE_UNAVAILABLE" });
    assert.equal(f.calls, 0);
  } finally { await f.close(); }
});
test("falha de commit após gateway não retorna PAY e bloqueia nova criação", async () => {
  const f = await fixture({ env: { PAGBANK_API_TOKEN: "test-only-gateway-credential" },
    fetcher: async (_, options) => gatewayResponse(JSON.parse(options.body)) });
  try {
    const cookie = await session(f);
    f.repository.complete = async () => { throw Error("database-disconnected"); };
    const res = await checkout(f, cookie);
    assert.equal(res.status, 503);
    assert(!JSON.stringify(await res.json()).includes("checkoutUrl"));
    assert.equal((await checkout(f, cookie)).status, 202);
    assert.equal(f.calls, 1);
  } finally { await f.close(); }
});

test("sem token: mock persistido, sem rede, link inventado ou status pago", async () => {
  const f = await fixture();
  try {
    const cookie = await session(f);
    const res = await checkout(f, cookie);
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.mode, "mock");
    assert.equal(data.status, "PENDING");
    assert.equal(data.checkoutUrl, null);
    assert.equal(f.calls, 0);
    assert.equal((await checkout(f, cookie)).status, 200);
    const { rows: [order] } = await f.db.query("SELECT * FROM nour_orders");
    assert.equal(order.gateway_mode, "mock");
    assert.equal(order.checkout_id, null);
    assert.equal(order.checkout_url, null);
  } finally { await f.close(); }
});

test("configuração ausente, produção e falha de banco falham fechadas", async () => {
  for (const env of [{}, { ...testEnv, PAGBANK_ENVIRONMENT: "production" },
    { ...testEnv, SITE_ORIGIN: "http://nour.test" }, { ...testEnv, SITE_ORIGIN: "https://nour.test/path" },
    { ...testEnv, SITE_ORIGIN: "https://nour.test?x=1" }, { ...testEnv, CHECKOUT_ABUSE_SECRET: "" }]) {
    let touched = false;
    const handlers = createHandlers({ env: () => env, getRepository: () => { touched = true; throw Error(); } });
    assert.equal((await handlers.checkout(request("/api/checkouts", { planId: "mensal" }), context)).status, 503);
    assert.equal(touched, false);
  }
  const handlers = createHandlers({ env: () => testEnv, getRepository: () => { throw Error("sensitive-dsn"); } });
  const res = await handlers.session(request("/api/checkout-session"), context);
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: "SERVICE_UNAVAILABLE" });
  assert.throws(() => configuration({ ...testEnv, PAGBANK_API_TOKEN: "FICTICIO_CONFIGURAR" }));
  const rejected = await liveHandler(request("/api/checkouts", {}, { method: "DELETE" }));
  assert.equal(rejected.status, 405);
});

test("métodos, Origin, CSRF, conteúdo, tamanho, cookie e chave estritamente validados", async () => {
  const f = await fixture();
  try {
    const cookie = await session(f);
    for (const [options, expected] of [
      [{ method: "GET" },405], [{ method: "OPTIONS" },405],
      [{ headers: { Origin: "https://evil.test" } },403],
      [{ headers: { Origin: "" } },403],
      [{ headers: { "Sec-Fetch-Site": "cross-site" } },403],
      [{ headers: { "Content-Type": "text/plain" } },415],
      [{ headers: { "Content-Encoding": "gzip" } },415],
      [{ headers: { "Content-Length": "1025" } },413],
      [{ cookie: "" },401], [{ key: "invalid" },400],
    ]) {
      const res = await f.handlers.checkout(request("/api/checkouts", { planId: "mensal" }, { cookie, key: randomUUID(), ...options }), context);
      assert.equal(res.status, expected);
      assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
      assert.equal(res.headers.get("Cache-Control"), "no-store");
    }
    const tooBig = await f.handlers.checkout(request("/api/checkouts", " ".repeat(1025), { cookie, key: randomUUID() }), context);
    assert.equal(tooBig.status, 413);
    assert.equal((await checkout(f, cookie, "mensal", randomUUID(), {})).status, 503);
    assert.equal(f.calls, 0);
  } finally { await f.close(); }
});

test("sessão: cookie seguro, só hash no banco, reuso e expiração sem substituição", async () => {
  const f = await fixture();
  try {
    const res = await f.handlers.session(request("/api/checkout-session"), context);
    const setCookie = res.headers.get("set-cookie");
    assert.match(setCookie, /__Host-nour-order=[a-f0-9]{64}; Secure; HttpOnly; SameSite=Lax; Path=\/; Max-Age=86400/);
    const cookie = setCookie.split(";")[0];
    const stored = (await f.db.query("SELECT session_hash FROM nour_checkout_clients")).rows[0].session_hash;
    assert.notEqual(stored, cookie.split("=")[1]);
    const reuse = await f.handlers.session(request("/api/checkout-session", {}, { cookie }), context);
    assert.equal(reuse.headers.get("set-cookie"), null);
    f.advance(86401000);
    const expired = await f.handlers.session(request("/api/checkout-session", {}, { cookie }), context);
    assert.equal(expired.status, 401);
    assert.equal(expired.headers.get("set-cookie"), null);
    assert.equal((await checkout(f, "__Host-nour-order=" + "a".repeat(64))).status, 401);
  } finally { await f.close(); }
});

test("limites persistentes por sessão e IP, incluindo clientes com cookies diferentes", async () => {
  const f = await fixture();
  try {
    const cookie = await session(f);
    for (let i = 0; i < 5; i++) assert([200,201].includes((await checkout(f, cookie)).status));
    const limited = await checkout(f, cookie);
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "60");
    f.advance(61000);
    assert.equal((await checkout(f, cookie)).status, 200);
    for (let i = 0; i < 20; i++) assert.equal((await f.handlers.session(request("/api/checkout-session"), context)).status, 200);
    assert.equal((await f.handlers.session(request("/api/checkout-session"), context)).status, 429);
    const limits = JSON.stringify((await f.db.query("SELECT * FROM nour_checkout_limits")).rows);
    assert(!limits.includes(context.ip));
  } finally { await f.close(); }
});

test("crash com lease vencido vira UNKNOWN e pedido expirado não é recriado", async () => {
  const f = await fixture();
  try {
    const cookie = await session(f);
    await checkout(f, cookie);
    await f.db.query("UPDATE nour_checkout_attempts SET state = 'CREATING', lease_until = now() - interval '1 minute'");
    assert.equal((await checkout(f, cookie)).status, 202);
    f.advance(7201000);
    assert.equal((await checkout(f, cookie)).status, 202);
    assert.equal(f.calls, 0);
    await f.db.query("UPDATE nour_checkout_attempts SET state = 'CREATED'");
    assert.equal((await checkout(f, cookie)).status, 409);
  } finally { await f.close(); }
});

test("migrações reais: unicidade, rollback e restrições financeiras", async () => {
  const f = await fixture();
  try {
    const cookie = await session(f);
    await checkout(f, cookie);
    await assert.rejects(f.repository.transaction(async db => {
      await db.query("UPDATE nour_orders SET plan_name = 'SHOULD_ROLLBACK'");
      throw Error("rollback");
    }));
    assert.notEqual((await f.db.query("SELECT plan_name FROM nour_orders")).rows[0].plan_name, "SHOULD_ROLLBACK");
    await assert.rejects(f.db.query("UPDATE nour_orders SET status = 'PAID'"));
    await assert.rejects(f.db.query("UPDATE nour_orders SET amount_cents = -1"));
    await assert.rejects(f.db.query("UPDATE nour_orders SET checkout_url = 'https://evil.test', checkout_id = 'CHEC_fake'"));
    await assert.rejects(f.db.query("INSERT INTO nour_checkout_clients SELECT * FROM nour_checkout_clients"));
    assert.equal((await f.db.query("SELECT status FROM nour_orders")).rows[0].status, "PENDING");
  } finally { await f.close(); }
});

test("allowlist não aceita produção, sufixos, userinfo, porta, caminho ou parâmetros extras", () => {
  for (const url of [
    "http://sandbox.pagamento.pagseguro.uol.com.br/pagamento?code=x",
    "https://pagamento.pagseguro.uol.com.br/pagamento?code=x",
    "https://sandbox.pagamento.pagseguro.uol.com.br.evil.test/pagamento?code=x",
    "https://evil.test@sandbox.pagamento.pagseguro.uol.com.br/pagamento?code=x",
    "https://sandbox.pagamento.pagseguro.uol.com.br:444/pagamento?code=x",
    "https://sandbox.pagamento.pagseguro.uol.com.br/other?code=x",
    "https://sandbox.pagamento.pagseguro.uol.com.br/pagamento?code=x&return=https://evil.test",
  ]) assert.equal(validPaymentUrl(url), false, url);
});


test("falha durante reserva desfaz pedido, tentativa e vínculo na mesma transação", async () => {
  const f = await fixture();
  try {
    const cookie = await session(f);
    const audit = f.repository.audit;
    f.repository.audit = async () => { throw Error("forced-transaction-rollback"); };
    assert.equal((await checkout(f, cookie)).status, 503);
    for (const table of ["nour_orders", "nour_checkout_attempts", "nour_order_sessions"]) {
      assert.equal((await f.db.query("SELECT count(*)::int AS n FROM " + table)).rows[0].n, 0);
    }
    f.repository.audit = audit;
    assert.equal((await checkout(f, cookie)).status, 201);
    assert.equal(f.calls, 0);
  } finally { await f.close(); }
});

test("nova instância da Function reutiliza pedido e limites persistidos", async () => {
  const f = await fixture();
  try {
    const cookie = await session(f);
    const original = await (await checkout(f, cookie)).json();
    const nextRepository = new f.repository.constructor(f.repository.pool);
    const nextHandlers = createHandlers({
      env: () => f.settings, getRepository: async () => nextRepository,
      fetcher: () => { throw Error("NETWORK_FORBIDDEN"); },
    });
    for (let i = 0; i < 4; i++) {
      const result = await nextHandlers.checkout(request("/api/checkouts", { planId: "mensal" }, { cookie, key: randomUUID() }), context);
      assert.equal(result.status, 200);
      assert.deepEqual(await result.json(), original);
    }
    assert.equal((await nextHandlers.checkout(request("/api/checkouts", { planId: "mensal" }, { cookie, key: randomUUID() }), context)).status, 429);
  } finally { await f.close(); }
});

test("corpo que nunca termina não é aceito como JSON válido após timeout", async () => {
  const handlers = createHandlers({
    env: () => testEnv,
    getRepository: () => { throw Error("DATABASE_MUST_NOT_BE_TOUCHED"); },
  });
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('{"planId":"mensal"}')); },
  });
  const req = new Request(testEnv.SITE_ORIGIN + "/api/checkouts", {
    method: "POST", duplex: "half", body,
    headers: { Origin: testEnv.SITE_ORIGIN, "Content-Type": "application/json" },
  });
  const result = await handlers.checkout(req, context);
  assert.equal(result.status, 408);
  assert.deepEqual(await result.json(), { error: "BODY_TIMEOUT" });
});
