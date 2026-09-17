import { paymentHandlers } from "../../server/payments/runtime.mjs";
// Scheduled Functions não possuem URL pública invocável em produção.
export default async () => {
  try { await paymentHandlers.worker(); }
  catch { console.error("PAYMENT_WORKER_UNAVAILABLE"); }
};
export const config = { schedule: "* * * * *" };
