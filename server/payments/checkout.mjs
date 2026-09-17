import {
  CheckoutError, configuration, checkRequest, planFromRequest, readBody,
  sessionFromRequest, newSession, ipKey, response, errorResponse, uuidPattern,
} from "./input.mjs";
import { createGateway, validPaymentUrl } from "./gateway.mjs";

function publicOrder(order, status) {
  if (order.state !== "CREATED") return response({
    code: order.public_code, mode: order.gateway_mode, status: "PENDING",
    error: order.state === "UNKNOWN" ? "GATEWAY_UNCERTAIN" : "CHECKOUT_IN_PROGRESS",
  }, 202, { "Retry-After": "10" });
  if (order.gateway_mode !== "mock" && !validPaymentUrl(order.checkout_url))
    throw new CheckoutError("CHECKOUT_REVIEW_REQUIRED", 409);
  return response({ code: order.public_code, mode: order.gateway_mode,
    status: "PENDING", checkoutUrl: order.gateway_mode === "mock" ? null : order.checkout_url }, status);
}

// Injeção explícita para testes; as Functions não importam fixtures ou banco em memória.
export function createHandlers({ env, getRepository, fetcher = fetch }) {
  return {
    async session(request, context) {
      try {
        if (request.method !== "POST") throw new CheckoutError("METHOD_NOT_ALLOWED", 405);
        const config = configuration(env());
        checkRequest(request, config);
        if (!/^\s*\{\s*\}\s*$/.test(await readBody(request))) throw new CheckoutError("INVALID_BODY");
        const sessionHash = sessionFromRequest(request);
        // Cookie malformado nunca é substituído silenciosamente.
        if (!sessionHash && (request.headers.get("cookie") || "").includes("__Host-nour-order="))
          throw new CheckoutError("SESSION_EXPIRED", 401);
        const repository = await getRepository();
        await repository.limit("session", ipKey(context, config), sessionHash);
        const fresh = newSession();
        const created = await repository.session(sessionHash, fresh.sessionHash);
        return response({ mode: config.mode }, 200, created ? { "Set-Cookie": fresh.cookie } : {});
      } catch (error) { return errorResponse(error); }
    },
    async checkout(request, context) {
      try {
        if (request.method !== "POST") throw new CheckoutError("METHOD_NOT_ALLOWED", 405);
        const config = configuration(env());
        checkRequest(request, config);
        const planId = await planFromRequest(request);
        const key = request.headers.get("idempotency-key");
        if (!uuidPattern.test(key || "")) throw new CheckoutError("INVALID_IDEMPOTENCY_KEY");
        const sessionHash = sessionFromRequest(request);
        if (!sessionHash) throw new CheckoutError("SESSION_REQUIRED", 401);
        const repository = await getRepository();
        await repository.limit("checkout", ipKey(context, config), sessionHash);
        const reserved = await repository.reserve({ sessionHash, idempotencyKey: key, planId, mode: config.mode });
        if (!reserved.create) return publicOrder(reserved.order, 200);
        let result;
        try { result = await createGateway(config, fetcher).create(reserved.order); }
        catch (error) {
          const code = error instanceof CheckoutError ? error.code : "GATEWAY_UNCERTAIN";
          await repository.failed(reserved.order.id, code);
          if (code === "GATEWAY_REJECTED") throw error;
          return publicOrder({ ...reserved.order, state: "UNKNOWN" }, 202);
        }
        try {
          return publicOrder(await repository.complete(reserved.order.id, result), 201);
        } catch {
          // Nunca devolver PAY antes de commit. Uma gravação incerta não permite outro POST.
          await repository.failed(reserved.order.id, "GATEWAY_UNCERTAIN");
          throw new CheckoutError("SERVICE_UNAVAILABLE", 503);
        }
      } catch (error) { return errorResponse(error); }
    },
  };
}
