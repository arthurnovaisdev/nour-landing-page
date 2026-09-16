import { createHash, timingSafeEqual } from "node:crypto";

// Exclusivo ao contrato Order/Charge x-authenticity-token.
// Não está ligado à rota. Não presumir compatibilidade com todo webhook Checkout
// ou com a nova API de Notificação ECDSA. Homologar cada família primeiro.
export function verifyOrderChargeSignature(rawBody, signature, apiToken) {
  if (!Buffer.isBuffer(rawBody) || !rawBody.length || rawBody.length > 65536
    || typeof apiToken !== "string" || !apiToken.length
    || typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }
  const expected = createHash("sha256")
    .update(apiToken, "utf8").update("-", "utf8").update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
