import { unavailable } from "../../server/payments/http.mjs";

// Não retorna 2xx sem persistência. Autenticidade e reconciliação ainda pendentes.
export default async function handler(request) {
  return unavailable(request, "POST");
}

export const config = { path: "/api/webhooks/pagbank" };
