import { paymentHandlers } from "../../server/payments/runtime.mjs";
export default paymentHandlers.webhook;
export const config = { path: "/api/webhooks/pagbank" };
