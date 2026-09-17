import { handlers } from "../../server/payments/runtime.mjs";

export default handlers.checkout;
export const config = { path: "/api/checkouts" };
