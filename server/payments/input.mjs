import { createHash, createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";

export class CheckoutError extends Error {
  constructor(code, status = 400, retryAfter) {
    super(code);
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}
export const hash = value => createHash("sha256").update(value).digest("hex");
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const SESSION_COOKIE = "__Host-nour-order";
export const SESSION_SECONDS = 86400;

export function configuration(env) {
  if (env.PAGBANK_ENVIRONMENT !== "sandbox") throw new CheckoutError("SANDBOX_ONLY", 503);
  let origin;
  try { origin = new URL(env.SITE_ORIGIN); } catch { throw new CheckoutError("CONFIGURATION_MISSING", 503); }
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.port
    || origin.pathname !== "/" || origin.search || origin.hash
    || origin.hostname === "localhost" || isIP(origin.hostname)
    || origin.hostname.endsWith(".invalid")) throw new CheckoutError("CONFIGURATION_INVALID", 503);
  const token = env.PAGBANK_API_TOKEN?.trim() || "";
  if (token && (/FICTICIO|CONFIGURAR|EXAMPLE|PLACEHOLDER/i.test(token) || /\s/.test(token)))
    throw new CheckoutError("CONFIGURATION_INVALID", 503);
  // Ausência de token é uma simulação explícita; nunca inventa URL de pagamento.
  const mode = token ? "sandbox" : "mock";
  const secret = env.CHECKOUT_ABUSE_SECRET;
  if (typeof secret !== "string" || secret.length < 32 || /FICTICIO|CONFIGURAR/.test(secret))
    throw new CheckoutError("CONFIGURATION_MISSING", 503);
  const notificationUrl = origin.origin + "/api/webhooks/pagbank";
  if (notificationUrl.length > 100) throw new CheckoutError("CONFIGURATION_INVALID", 503);
  return Object.freeze({
    mode, token, origin: origin.origin, abuseSecret: secret,
    redirectUrl: origin.origin + "/checkout-return.html",
    returnUrl: origin.origin + "/checkout-return.html",
    notificationUrl,
  });
}

export function response(body, status = 200, extra = {}) {
  return Response.json(body, { status, headers: {
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer", ...extra,
  } });
}

export function checkRequest(request, config) {
  if (request.method !== "POST") throw new CheckoutError("METHOD_NOT_ALLOWED", 405);
  const url = new URL(request.url);
  if (url.origin !== config.origin || url.search
    || request.headers.get("origin") !== config.origin
    || (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin"))
    throw new CheckoutError("ORIGIN_NOT_ALLOWED", 403);
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") || ""))
    throw new CheckoutError("CONTENT_TYPE_NOT_ALLOWED", 415);
  if (request.headers.has("content-encoding")) throw new CheckoutError("CONTENT_ENCODING_NOT_ALLOWED", 415);
}

export async function readBody(request, limit = 1024, raw = false) {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit))
    throw new CheckoutError("BODY_TOO_LARGE", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new CheckoutError("INVALID_BODY");
  const chunks = [];
  let size = 0;
  // Limite também no stream: Content-Length não é confiável.
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, 3000);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        void reader.cancel().catch(() => {});
        throw new CheckoutError("BODY_TOO_LARGE", 413);
      }
      chunks.push(Buffer.from(value));
    }
    if (timedOut) throw new CheckoutError("BODY_TIMEOUT", 408);
    const bytes = Buffer.concat(chunks); return raw ? bytes : new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    if (error instanceof CheckoutError) throw error;
    throw new CheckoutError("INVALID_BODY");
  } finally { clearTimeout(timer); reader.releaseLock(); }
}

export async function planFromRequest(request) {
  const text = await readBody(request);
  // Gramática fechada também recusa chaves JSON duplicadas e propriedades extras.
  const match = /^\s*\{\s*"planId"\s*:\s*"(mensal|semestral|anual)"\s*\}\s*$/.exec(text);
  if (!match) throw new CheckoutError("INVALID_PLAN_OR_BODY");
  return match[1];
}

export function sessionFromRequest(request) {
  const cookies = (request.headers.get("cookie") || "").split(";")
    .map(value => value.trim()).filter(value => value.startsWith(SESSION_COOKIE + "="));
  if (cookies.length !== 1) return null;
  const token = cookies[0].slice(SESSION_COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? hash(token) : null;
}
export function newSession() {
  const token = randomBytes(32).toString("hex");
  return { sessionHash: hash(token), cookie: `${SESSION_COOKIE}=${token}; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}` };
}
export function ipKey(context, config) {
  // context.ip é fornecido pela Netlify. Nunca confiar em X-Forwarded-For do cliente.
  if (!isIP(context?.ip)) throw new CheckoutError("CLIENT_CONTEXT_MISSING", 503);
  return createHmac("sha256", config.abuseSecret).update(context.ip).digest("hex");
}
export function errorResponse(error) {
  const known = error instanceof CheckoutError;
  const code = known ? error.code : "SERVICE_UNAVAILABLE";
  const status = known ? error.status : 503;
  return response({ error: code }, status, {
    ...(status === 405 ? { Allow: "POST" } : {}),
    ...(known && error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {}),
  });
}
