import { handlers } from "../../server/payments/runtime.mjs";

export default handlers.session;
export const config = { path: "/api/checkout-session" };
