import { unavailable } from "../../server/payments/http.mjs";

// Contrato futuro: sessão vinculada ao pedido; código público não autentica.
export default async function handler(request) {
  return unavailable(request, "GET");
}

export const config = { path: "/api/orders/status" };
