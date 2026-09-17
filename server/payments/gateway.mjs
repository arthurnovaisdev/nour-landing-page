import { CheckoutError, readBody } from "./input.mjs";

export const SANDBOX_API = "https://sandbox.api.pagseguro.com/checkouts";
// Host Sandbox estrito. A resposta real da conta precisa ser homologada antes de uso.
// Hosts de produção, QA, sufixos parecidos e URLs fornecidas pelo cliente não entram.
export const SANDBOX_PAY_HOST = "sandbox.pagamento.pagseguro.uol.com.br";

export function validPaymentUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === SANDBOX_PAY_HOST
      && !url.username && !url.password && !url.port && !url.hash
      && url.pathname === "/pagamento"
      && [...url.searchParams.keys()].length === 1
      && /^[a-zA-Z0-9-]{1,128}$/.test(url.searchParams.get("code") || "");
  } catch { return false; }
}

export function checkoutPayload(order, config) {
  return {
    reference_id: order.id,
    expiration_date: new Date(order.checkout_expires_at).toISOString(),
    customer_modifiable: true,
    items: [{ reference_id: order.plan_id, name: order.plan_name,
      description: order.plan_description, quantity: 1, unit_amount: order.amount_cents }],
    additional_amount: 0, discount_amount: 0,
    // Cobrança única, sem recorrência. Parcelamento/juros não homologados nesta etapa.
    payment_methods: [{ type: "PIX" }, { type: "CREDIT_CARD" }],
    payment_methods_configs: [{ type: "CREDIT_CARD", config_options: [{ option: "INSTALLMENTS_LIMIT", value: "1" }] }],
    redirect_url: config.redirectUrl, return_url: config.returnUrl,
    notification_urls: [config.notificationUrl],
    payment_notification_urls: [config.notificationUrl],
  };
}

export function createGateway(config, fetcher = fetch) {
  return {
    async create(order) {
      if (config.mode === "mock") return { checkoutId: null, checkoutUrl: null };
      let result;
      try {
        result = await fetcher(SANDBOX_API, {
          method: "POST", redirect: "error", signal: AbortSignal.timeout(8000),
          headers: { Authorization: "Bearer " + config.token, Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify(checkoutPayload(order, config)),
          // Não enviar x-idempotency-key: contrato Checkout não o garante.
        });
      } catch { throw new CheckoutError("GATEWAY_UNCERTAIN", 202); }
      if ([400, 401, 403, 422].includes(result.status)) {
        void result.body?.cancel().catch(() => {});
        throw new CheckoutError("GATEWAY_REJECTED", 502, 10);
      }
      if (!result.ok) {
        void result.body?.cancel().catch(() => {});
        throw new CheckoutError("GATEWAY_UNCERTAIN", 202);
      }
      try {
        if (!/^application\/json(?:;|$)/i.test(result.headers.get("content-type") || "")) throw Error();
        const data = JSON.parse(await readBody(result, 65536));
        const links = data.links?.filter(link => link.rel === "PAY" && link.method === "GET");
        const expires = Date.parse(data.expiration_date);
        if (!/^CHEC_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data.id)
          || data.reference_id !== order.id || data.status !== "ACTIVE"
          || !Array.isArray(data.items) || data.items.length !== 1
          || data.items[0].reference_id !== order.plan_id || data.items[0].quantity !== 1
          || data.items[0].unit_amount !== order.amount_cents
          || (data.additional_amount ?? 0) !== 0 || (data.discount_amount ?? 0) !== 0
          || data.shipping != null || data.recurrence_plan != null
          || !Number.isFinite(expires) || expires <= Date.now()
          || expires > new Date(order.checkout_expires_at).getTime() + 1000
          || links?.length !== 1 || !validPaymentUrl(links[0].href)) throw Error();
        return { checkoutId: data.id, checkoutUrl: links[0].href };
      } catch {
        // Resposta inválida pode ocorrer DEPOIS de criar: proibir nova criação.
        throw new CheckoutError("GATEWAY_UNCERTAIN", 202);
      }
    },
  };
}
