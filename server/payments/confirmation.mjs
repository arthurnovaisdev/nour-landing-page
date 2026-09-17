import { configuration, CheckoutError, response, errorResponse, readBody, checkRequest, sessionFromRequest, hash, ipKey } from "./input.mjs";
import { createReadApi, createNotificationVerifier, notificationResource, parseJson, reconcile } from "./reconciliation.mjs";
import { eligible } from "./payment-repository.mjs";
import { validPaymentUrl } from "./gateway.mjs";

export function publicStatus(order, now = new Date()) {
  const fresh = order.verified_at && now - new Date(order.verified_at) <= 60000 && now >= new Date(order.verified_at);
  let state = "TEMPORARY_ERROR";
  if (order.gateway_mode === "mock" || (order.status === "PENDING" && !order.review_required && !order.reconciliation_pending)) state = "WAITING";
  else if (["REFUNDED", "CHARGEBACK"].includes(order.status)) state = "BLOCKED";
  else if (!order.reconciliation_pending && !order.review_required && fresh) {
    if (order.status === "PAID") state = eligible(order, now) ? "PAID" : "TEMPORARY_ERROR";
    else if (["WAITING","IN_ANALYSIS","DECLINED","CANCELED","EXPIRED"].includes(order.status)) state = order.status;
  }
  return { state, canRetry: ["DECLINED","CANCELED","EXPIRED"].includes(state)
    && order.paid_cents === 0 && !order.disputed
    && (order.checkout_status === "EXPIRED" || (order.checkout_status === "ACTIVE" && new Date(order.checkout_expires_at) > now)),
    // Acesso VIP continua manual. Nenhum convite ou WhatsApp é devolvido nesta etapa.
    access: "BLOCKED", mode: order.gateway_mode };
}

export function createPaymentHandlers({ env, getRepository, fetcher = fetch }) {
  const authenticate = createNotificationVerifier();
  async function processOne(repository, config, orderId) {
    const job = await repository.claim(orderId);
    if (!job) return false;
    let snapshot, failure;
    try { snapshot = await reconcile(job.order, job.resources, createReadApi(config, fetcher), repository.clock); }
    catch (error) { failure = error.code === "RECONCILIATION_MISMATCH" ? error.code : "PROVIDER_UNAVAILABLE"; }
    await repository.finish(job, snapshot, failure);
    return true;
  }
  function getConfig() { return configuration(env()); }
  function statusRequest(request, config) {
    if (request.method !== "GET") throw new CheckoutError("METHOD_NOT_ALLOWED", 405);
    const url = new URL(request.url);
    if (url.origin !== config.origin || url.search
      || (request.headers.has("origin") && request.headers.get("origin") !== config.origin)
      || (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin"))
      throw new CheckoutError("ORIGIN_NOT_ALLOWED", 403);
  }
  return {
    async webhook(request, context) {
      try {
        if (request.method !== "POST") throw new CheckoutError("METHOD_NOT_ALLOWED", 405);
        const config = getConfig();
        if (config.mode !== "sandbox") throw new CheckoutError("SANDBOX_ONLY", 503);
        const url = new URL(request.url);
        if (url.origin !== config.origin || url.search || request.headers.has("origin")
          || (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "none"))
          throw new CheckoutError("ORIGIN_NOT_ALLOWED", 403);
        if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") || "")
          || request.headers.has("content-encoding")) throw new CheckoutError("CONTENT_TYPE_NOT_ALLOWED", 415);
        const repository = await getRepository();
        await repository.limit("webhook", ipKey(context, config), null);
        const raw = await readBody(request, 65536, true);
        const scheme = await authenticate(raw, request.headers, config, createReadApi(config, fetcher));
        const resource = notificationResource(parseJson(raw), scheme, request.headers);
        await repository.ingest(resource, hash(raw), scheme);
        // ACK somente após commit. Worker agendado executa a consulta; não depende do navegador.
        return new Response(null, { status: 204, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
      } catch (error) { return errorResponse(error); }
    },
    async status(request, context) {
      try {
        if (request.method !== "GET") throw new CheckoutError("METHOD_NOT_ALLOWED", 405);
        const config = getConfig();
        statusRequest(request, config);
        const sessionHash = sessionFromRequest(request);
        if (!sessionHash) throw new CheckoutError("SESSION_UNAVAILABLE", 401);
        const repository = await getRepository();
        await repository.limit("status", ipKey(context, config), sessionHash);
        let order = await repository.orderForSession(sessionHash);
        if (order.gateway_mode !== config.mode) throw new CheckoutError("SERVICE_UNAVAILABLE", 503);
        await repository.enqueue(order.id);
        await processOne(repository, config, order.id);
        order = await repository.orderForSession(sessionHash);
        return response(publicStatus(order, repository.clock()));
      } catch (error) {
        if (error.status === 405) return response({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "GET" });
        return errorResponse(error);
      }
    },
    async retry(request, context) {
      try {
        const config = getConfig(); checkRequest(request, config);
        if (!/^\s*\{\s*\}\s*$/.test(await readBody(request))) throw new CheckoutError("INVALID_BODY");
        const sessionHash = sessionFromRequest(request);
        if (!sessionHash) throw new CheckoutError("SESSION_UNAVAILABLE", 401);
        const repository = await getRepository();
        await repository.limit("retry", ipKey(context, config), sessionHash);
        const order = await repository.orderForSession(sessionHash);
        // Consulta nova antes de retomar ou permitir outro pedido.
        await repository.enqueue(order.id, true);
        await processOne(repository, config, order.id);
        const result = await repository.retry(sessionHash);
        if (result.checkoutUrl && !validPaymentUrl(result.checkoutUrl)) throw new CheckoutError("RETRY_NOT_SAFE", 409);
        return response(result);
      } catch (error) { return errorResponse(error); }
    },
    async worker() {
      const config = getConfig();
      if (config.mode !== "sandbox") return;
      const repository = await getRepository();
      for (const id of await repository.dueOrders()) await repository.enqueue(id);
      await processOne(repository, config);
    },
    processOne,
  };
}





