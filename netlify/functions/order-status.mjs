import { paymentHandlers } from "../../server/payments/runtime.mjs";
export default paymentHandlers.status;
export const config = { path: "/api/orders/status" };
