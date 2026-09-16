import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ORDER_STATUSES, getPlan, checkoutExpiresAt, accessExpiresAt, canOpenPostPayment } from "../server/payments/policy.mjs";
import { verifyOrderChargeSignature } from "../server/payments/authenticity.mjs";
import createCheckout from "../netlify/functions/create-checkout.mjs";
import orderStatus from "../netlify/functions/order-status.mjs";
import webhook from "../netlify/functions/pagbank-webhook.mjs";

const now = new Date("2026-09-16T12:00:00Z");
const paid = {
  status: "PAID", verificationSource: "PAGBANK_API",
  checkoutId: "CHEC_fixture", chargeId: "CHAR_fixture",
  amountCents: 10000, paidCents: 10000, currency: "BRL",
  refundedCents: 0, disputed: false, reviewRequired: false,
  paidAt: new Date("2026-09-16T11:58:00Z"), verifiedAt: now,
};

test("catálogo não aceita chaves herdadas, objetos ou plano arbitrário", () => {
  for (const id of ["__proto__", "constructor", "toString", "premium", {}, null]) {
    assert.throws(() => getPlan(id), /INVALID_PLAN/);
  }
  assert.equal(getPlan("mensal").amountCents, 10000);
  assert.equal(getPlan("semestral").amountCents, 50000);
  assert.equal(getPlan("anual").amountCents, 80000);
  assert.throws(() => { getPlan("mensal").amountCents = 1; }, TypeError);
});

test("checkout expira em duas horas sem depender do plano", () => {
  assert.equal(checkoutExpiresAt(now).toISOString(), "2026-09-16T14:00:00.000Z");
  assert.throws(() => checkoutExpiresAt(new Date("invalid")), /INVALID_DATE/);
});

test("vigência usa meses de calendário, incluindo fim de mês e ano bissexto", () => {
  const cases = [
    ["2026-01-31T13:30:00Z", "mensal", "2026-02-28T13:30:00.000Z"],
    ["2028-01-31T13:30:00Z", "mensal", "2028-02-29T13:30:00.000Z"],
    ["2026-08-31T13:30:00Z", "semestral", "2027-02-28T13:30:00.000Z"],
    ["2028-02-29T13:30:00Z", "anual", "2029-02-28T13:30:00.000Z"],
  ];
  for (const [start, plan, end] of cases) {
    assert.equal(accessExpiresAt(new Date(start), plan).toISOString(), end);
  }
});

test("somente PAID com evidência completa pode habilitar a etapa", () => {
  for (const status of ORDER_STATUSES) {
    assert.equal(canOpenPostPayment({ ...paid, status }, now), status === "PAID");
  }
  assert.equal(canOpenPostPayment({ status: "PAID" }, now), false);
  assert.equal(canOpenPostPayment(undefined, now), false);
  for (const key of Object.keys(paid)) {
    const incomplete = { ...paid };
    delete incomplete[key];
    assert.equal(canOpenPostPayment(incomplete, now), false, key);
  }
});

test("fraude, divergência de valor, estorno e disputa impedem liberação", () => {
  for (const patch of [
    { verificationSource: "BROWSER" }, { amountCents: 0 }, { paidCents: 9999 },
    { paidCents: 10001 }, { amountCents: 1.5 }, { currency: "USD" },
    { refundedCents: 1 }, { disputed: true }, { reviewRequired: true },
    { chargeId: "unknown" }, { checkoutId: "unknown" },
    { status: "AUTHORIZED" }, { paidAt: new Date("invalid") },
  ]) assert.equal(canOpenPostPayment({ ...paid, ...patch }, now), false);
});

test("confirmação vencida, futura ou inconsistente não libera", () => {
  assert.equal(canOpenPostPayment(paid, new Date(now.getTime() + 300000)), true);
  assert.equal(canOpenPostPayment(paid, new Date(now.getTime() + 300001)), false);
  assert.equal(canOpenPostPayment(paid, new Date(now.getTime() - 1)), false);
  assert.equal(canOpenPostPayment({ ...paid, paidAt: new Date(now.getTime() + 1) }, now), false);
});

test("assinatura Order/Charge vincula bytes exatos e token fictício", () => {
  const token = "FICTICIO_USADO_SOMENTE_NO_TESTE";
  const body = Buffer.from('{"id":"CHAR_fixture","description":"ação","status":"PAID"}');
  const signature = createHash("sha256").update(token + "-").update(body).digest("hex");
  assert.equal(verifyOrderChargeSignature(body, signature, token), true);
  assert.equal(verifyOrderChargeSignature(Buffer.from(body + " "), signature, token), false);
  assert.equal(verifyOrderChargeSignature(body, signature, "OUTRO_FICTICIO"), false);
  assert.equal(verifyOrderChargeSignature(body, "0".repeat(64), token), false);
  assert.equal(verifyOrderChargeSignature(body, "malformada", token), false);
  assert.equal(verifyOrderChargeSignature(body, undefined, token), false);
  assert.equal(verifyOrderChargeSignature(body.toString(), signature, token), false);
  assert.equal(verifyOrderChargeSignature(Buffer.alloc(65537), signature, token), false);
});

test("rotas não acessam rede nem habilitam pagamento por configuração ou payload", async () => {
  const originalFetch = globalThis.fetch;
  const previous = process.env.PAYMENTS_ENABLED;
  globalThis.fetch = () => { throw new Error("NETWORK_FORBIDDEN"); };
  process.env.PAYMENTS_ENABLED = "true";
  try {
    for (const [handler, method] of [[createCheckout, "POST"], [orderStatus, "GET"], [webhook, "POST"]]) {
      const request = new Request("https://nour.example.invalid/api/test?status=PAID", {
        method,
        ...(method === "POST" ? { body: '{"status":"PAID","planId":"anual","amount":1}' } : {}),
      });
      const response = await handler(request);
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      assert.deepEqual(await response.json(), { error: "PAYMENTS_NOT_IMPLEMENTED" });
      assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
      const rejected = await handler(new Request(request.url, { method: "DELETE" }));
      assert.equal(rejected.status, 405);
      assert.equal(rejected.headers.get("Allow"), method);
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.PAYMENTS_ENABLED;
    else process.env.PAYMENTS_ENABLED = previous;
  }
});
