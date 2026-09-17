import { createPublicKey, verify } from "node:crypto";
import { CheckoutError, readBody, uuidPattern, hash } from "./input.mjs";
import { verifyOrderChargeSignature } from "./authenticity.mjs";

const suffix = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
export const providerId = (value, prefix) => typeof value === "string" && new RegExp("^" + prefix + "_" + suffix + "$", "i").test(value);
export const mismatch = () => { throw new CheckoutError("RECONCILIATION_MISMATCH", 503); };
export function parseJson(bytes) {
  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    const value = JSON.parse(text);
    const stack = [];
    for (const token of text.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\]]/g)) {
      if (token[0] === "{") stack.push(new Set());
      else if (token[0] === "[") stack.push(null);
      else if (["}", "]"].includes(token[0])) stack.pop();
      else if (/^\s*:/.test(text.slice(token.index + token[0].length))) {
        const key = JSON.parse(token[0]);
        const keys = stack.at(-1);
        if (!keys || keys.has(key)) throw Error();
        keys.add(key);
      }
      if (stack.length > 24) throw Error();
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) throw Error();
    // Profundidade/tamanho estrutural limitados, além do limite em bytes.
    let count = 0;
    function inspect(node, depth) {
      if (++count > 8000 || depth > 24) throw Error();
      if (node && typeof node === "object") for (const [key, child] of Object.entries(node)) {
        if (["__proto__", "constructor", "prototype"].includes(key)) throw Error();
        inspect(child, depth + 1);
      }
    }
    inspect(value, 0);
    return value;
  } catch { throw new CheckoutError("INVALID_BODY"); }
}
export function createReadApi(config, fetcher = fetch) {
  const deadline = AbortSignal.timeout(20000);
  return async path => {
    if (config.mode !== "sandbox" || !config.token || !/^\/(checkouts\/CHEC_|orders\/ORDE_|chargebacks\/CBKS_|public-keys\?type=webhook)/.test(path))
      throw new CheckoutError("SANDBOX_ONLY", 503);
    try {
      const result = await fetcher("https://sandbox.api.pagseguro.com" + path, {
        method: "GET", redirect: "error", signal: AbortSignal.any([deadline, AbortSignal.timeout(6000)]),
        headers: { Authorization: "Bearer " + config.token, Accept: "application/json" },
      });
      if (!result.ok || !/^application\/json(?:;|$)/i.test(result.headers.get("content-type") || "")) {
        void result.body?.cancel().catch(() => {}); throw Error();
      }
      return parseJson(await readBody(result, 262144, true));
    } catch { throw new CheckoutError("PROVIDER_UNAVAILABLE", 503, 10); }
  };
}

// Cache apenas da chave pública. Nenhum estado de pagamento em memória.
export function createNotificationVerifier() {
  let cached;
  return async (raw, headers, config, api) => {
    const legacy = headers.get("x-authenticity-token");
    const modern = headers.get("x-payload-signature");
    if (legacy && modern) throw new CheckoutError("INVALID_SIGNATURE", 401);
    if (legacy) {
      if (!verifyOrderChargeSignature(raw, legacy, config.token)) throw new CheckoutError("INVALID_SIGNATURE", 401);
      return "ORDER_SHA256";
    }
    if (!modern || modern.length > 2048) throw new CheckoutError("INVALID_SIGNATURE", 401);
    const signatures = modern.split(",").map(s => s.trim());
    if (signatures.length > 8) throw new CheckoutError("INVALID_SIGNATURE", 401);
    const valid = key => signatures.some(signature => {
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(signature) || signature.length % 4) return false;
      try { return verify("sha256", raw, key, Buffer.from(signature, "base64")); } catch { return false; }
    });
    const tokenHash = hash(config.token);
    if (!cached || cached.tokenHash !== tokenHash || cached.until <= Date.now()) {
      const data = await api("/public-keys?type=webhook");
      try {
        if (typeof data.public_key !== "string" || data.public_key.length > 2048) throw Error();
        const key = createPublicKey({ key: Buffer.from(data.public_key, "base64"), format: "der", type: "spki" });
        if (key.asymmetricKeyType !== "ec") throw Error();
        cached = { key, tokenHash, until: Date.now() + 60000 };
      } catch { throw new CheckoutError("PUBLIC_KEY_UNAVAILABLE", 503); }
    }
    if (!valid(cached.key)) throw new CheckoutError("INVALID_SIGNATURE", 401);
    return "NOTIFICATION_ECDSA";
  };
}

export function notificationResource(data, scheme, headers) {
  // Famílias separadas. Não há fallback SHA para chargeback.
  const chargeback = providerId(data.id, "CBKS");
  if (chargeback && scheme !== "NOTIFICATION_ECDSA") throw new CheckoutError("INVALID_SIGNATURE", 401);
  if (!chargeback && scheme !== "ORDER_SHA256") throw new CheckoutError("UNSUPPORTED_EVENT", 400);
  const reference = chargeback ? data.transaction?.reference_id : data.reference_id;
  if (!uuidPattern.test(reference || "") || (!chargeback && !providerId(data.id, "CHEC") && !providerId(data.id, "ORDE")))
    throw new CheckoutError("INVALID_IDENTIFIERS");
  const origin = headers.get("x-product-origin");
  const product = headers.get("x-product-id");
  if (origin && !["CHECKOUT", "ORDER"].includes(origin)) throw new CheckoutError("INVALID_PRODUCT");
  if (product && !providerId(product, origin === "ORDER" ? "ORDE" : "CHEC")) throw new CheckoutError("INVALID_PRODUCT");
  if (providerId(data.id, "ORDE")) {
    if (!Array.isArray(data.charges) || !data.charges.length || data.charges.length > 100
      || data.charges.some(c => !providerId(c.id, "CHAR"))) throw new CheckoutError("INVALID_IDENTIFIERS");
  }
  return { reference: reference.toLowerCase(), resourceId: data.id, chargeback, product, origin };
}

function checkItems(data, order) {
  if (data.reference_id !== order.id || !Array.isArray(data.items) || data.items.length !== 1
    || data.items[0].reference_id !== order.plan_id || data.items[0].quantity !== 1
    || data.items[0].unit_amount !== order.amount_cents || (data.additional_amount ?? 0) !== 0
    || (data.discount_amount ?? 0) !== 0 || data.shipping != null || data.recurrence_plan != null) mismatch();
}
const statuses = ["PAID", "WAITING", "IN_ANALYSIS", "DECLINED", "CANCELED", "AUTHORIZED"];
export async function reconcile(order, resources, api, clock = () => new Date()) {
  if (order.gateway_mode !== "sandbox" || order.environment !== "sandbox" || !providerId(order.checkout_id, "CHEC")) mismatch();
  const orders = new Map();
  let checkout;
  // A coleção orders deve estar presente, inclusive vazia. Ausência não prova zero pagamentos.
  // O exemplo público de Checkout não detalha esta coleção; homologar o envelope na conta.
  for (let offset = 0; offset <= 500; offset += 100) {
    const page = await api(`/checkouts/${order.checkout_id}?offset=${offset}&limit=100`);
    checkItems(page, order);
    if (page.id !== order.checkout_id || !["ACTIVE", "INACTIVE", "EXPIRED"].includes(page.status)
      || !Array.isArray(page.orders) || page.orders.length > 100) mismatch();
    if (checkout && checkout.status !== page.status) mismatch();
    checkout = page;
    for (const item of page.orders) {
      if (!providerId(item?.id, "ORDE") || orders.has(item.id)) mismatch();
      orders.set(item.id, item);
    }
    if (page.orders.length < 100) break;
    if (offset === 500) mismatch();
  }
  for (const resource of resources.orders) if (!orders.has(resource)) mismatch();
  if (orders.size > 20) mismatch();
  const charges = [];
  for (const id of orders.keys()) {
    const data = await api("/orders/" + id);
    if (data.id !== id) mismatch();
    checkItems(data, order);
    if (!Array.isArray(data.charges) || data.charges.length > 100) mismatch();
    for (const c of data.charges) {
      const summary = c.amount?.summary;
      if (!providerId(c.id, "CHAR") || charges.some(v => v.id === c.id) || !statuses.includes(c.status)
        || c.amount?.currency !== order.currency || c.amount?.value !== order.amount_cents
        || summary?.total !== order.amount_cents || !Number.isSafeInteger(summary?.paid)
        || !Number.isSafeInteger(summary?.refunded) || summary.paid < 0 || summary.paid > order.amount_cents
        || summary.refunded < 0 || summary.refunded > summary.paid) mismatch();
      if (c.status === "PAID" && (summary.paid !== order.amount_cents || !Number.isFinite(Date.parse(c.paid_at)) || Date.parse(c.paid_at) > clock().getTime())) mismatch();
      charges.push({ ...c, providerOrderId: id });
    }
  }
  // Uma contestação confirmada permanece bloqueada inclusive WON/APPROVED: revisão manual.
  let disputed = order.disputed;
  for (const id of resources.chargebacks) {
    const data = await api("/chargebacks/" + id);
    if (data.id !== id || data.transaction?.reference_id !== order.id
      || data.transaction.amount !== order.amount_cents || data.amount?.currency !== "BRL"
      || !Number.isSafeInteger(data.amount.value) || data.amount.value <= 0 || data.amount.value > order.amount_cents
      || typeof data.status !== "string" || !data.status.length) mismatch();
    disputed = true;
  }
  const captured = charges.filter(c => c.amount.summary.paid > 0);
  if (captured.length > 1) mismatch();
  const paid = captured[0];
  let status;
  let review = order.review_required || order.superseded;
  if (disputed) status = "CHARGEBACK";
  else if (paid?.amount.summary.refunded === order.amount_cents) status = "REFUNDED";
  else if (paid?.status === "PAID") status = "PAID";
  else if (charges.some(c => ["IN_ANALYSIS", "AUTHORIZED"].includes(c.status))) status = "IN_ANALYSIS";
  else if (charges.some(c => c.status === "WAITING")) status = "WAITING";
  else if (checkout.status === "EXPIRED") status = "EXPIRED";
  else if (charges.some(c => c.status === "DECLINED")) status = "DECLINED";
  else if (charges.length && charges.every(c => c.status === "CANCELED")) status = "CANCELED";
  else status = "WAITING";
  if (paid && (paid.amount.summary.refunded > 0 || paid.status !== "PAID")) review = true;
  if (order.status === "PAID" && !["PAID", "REFUNDED", "CHARGEBACK"].includes(status)) mismatch();
  if (["REFUNDED", "CHARGEBACK"].includes(order.status) && status !== order.status) {
    status = order.status; review = true;
  }
  if (status === "PAID" && (order.status === "EXPIRED" || new Date(paid.paid_at) > new Date(order.checkout_expires_at))) review = true;
  if (checkout.status === "INACTIVE" && !paid) review = true;
  return {
    status, review, disputed, checkoutStatus: checkout.status,
    chargeId: paid?.id ?? order.charge_id, providerOrderId: paid?.providerOrderId ?? order.provider_order_id,
    paidCents: paid?.amount.summary.paid ?? order.paid_cents,
    refundedCents: Math.max(paid?.amount.summary.refunded ?? 0, order.refunded_cents),
    paidAt: paid?.paid_at ? new Date(paid.paid_at) : order.paid_at,
    verifiedAt: clock(),
  };
}



