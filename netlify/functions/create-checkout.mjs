import { unavailable } from "../../server/payments/http.mjs";

// Contrato futuro: POST { planId }, sessão HttpOnly e Idempotency-Key.
// Não recebe preço, status, URLs ou dados de cartão do navegador.
export default async function handler(request) {
  return unavailable(request, "POST");
}

export const config = { path: "/api/checkouts" };
