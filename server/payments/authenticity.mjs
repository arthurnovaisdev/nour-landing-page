import { createHash, timingSafeEqual } from "node:crypto";

// Exclusivo ao contrato Order/Charge x-authenticity-token.
// Checkout/Order conforme referência oficial; homologar eventos da conta.
// ECDSA tem contrato separado, sem fallback entre famílias.
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
