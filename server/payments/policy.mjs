// Política de domínio interna. Nunca importar em dist/ ou aplicar a JSON do cliente.
export const ORDER_STATUSES = Object.freeze([
  "PENDING", "WAITING", "IN_ANALYSIS", "PAID", "DECLINED",
  "CANCELED", "EXPIRED", "REFUNDED", "CHARGEBACK",
]);

// Snapshot dos preços já presentes na landing; confirmar condições antes de ativar.
export const PLANS = Object.freeze({
  mensal: Object.freeze({ amountCents: 10000, months: 1, currency: "BRL", name: "Nour — Mensal", description: "Consultoria e inteligência em criptoativos. Acesso por 1 mês após liberação manual." }),
  semestral: Object.freeze({ amountCents: 50000, months: 6, currency: "BRL", name: "Nour — Semestral", description: "Consultoria e inteligência em criptoativos. Acesso por 6 meses após liberação manual." }),
  anual: Object.freeze({ amountCents: 80000, months: 12, currency: "BRL", name: "Nour — Anual", description: "Consultoria e inteligência em criptoativos. Acesso por 12 meses após liberação manual." }),
});
export const CHECKOUT_TTL_MS = 2 * 60 * 60 * 1000;
export const VERIFICATION_TTL_MS = 5 * 60 * 1000;

export function getPlan(planId) {
  if (typeof planId !== "string" || !Object.hasOwn(PLANS, planId)) {
    throw new TypeError("INVALID_PLAN");
  }
  return PLANS[planId];
}

function instant(value) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new TypeError("INVALID_DATE");
  }
  return value.getTime();
}

export function checkoutExpiresAt(createdAt) {
  return new Date(instant(createdAt) + CHECKOUT_TTL_MS);
}

// Meses de calendário em UTC, com ajuste ao último dia do mês de destino.
// O banco armazena instantes; a UI futura apresenta em America/Bahia.
export function accessExpiresAt(grantedAt, planId) {
  const result = new Date(instant(grantedAt));
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + getPlan(planId).months);
  const lastDay = new Date(Date.UTC(
    result.getUTCFullYear(), result.getUTCMonth() + 1, 0,
  )).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

// Pré-condição adicional à autenticação, à posse do pedido e à transação no banco.
// Somente o adaptador de reconciliação autenticada poderá montar este snapshot.
export function canOpenPostPayment(order, now = new Date()) {
  const nowMs = instant(now);
  const checked = order?.verifiedAt;
  const paidAt = order?.paidAt;
  return order?.status === "PAID"
    && order.verificationSource === "PAGBANK_API"
    && typeof order.checkoutId === "string" && order.checkoutId.startsWith("CHEC_")
    && typeof order.chargeId === "string" && order.chargeId.startsWith("CHAR_")
    && Number.isSafeInteger(order.amountCents) && order.amountCents > 0
    && order.paidCents === order.amountCents && order.currency === "BRL"
    && order.refundedCents === 0 && order.disputed === false
    && order.reviewRequired === false
    && checked instanceof Date && Number.isFinite(checked.getTime())
    && paidAt instanceof Date && Number.isFinite(paidAt.getTime())
    && paidAt.getTime() <= checked.getTime()
    && checked.getTime() <= nowMs
    && nowMs - checked.getTime() <= VERIFICATION_TTL_MS;
}
