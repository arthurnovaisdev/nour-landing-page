import { paymentHandlers } from "../../server/payments/runtime.mjs";
export default paymentHandlers.retry;
export const config = { path: "/api/orders/retry" };
