import { createHandlers } from "./checkout.mjs";
import { createPaymentHandlers } from "./confirmation.mjs";
import { PaymentRepository } from "./payment-repository.mjs";
let repositoryPromise;
const dependencies = {
  env: () => process.env,
  getRepository() {
    repositoryPromise ??= import("@netlify/database").then(({ getDatabase }) => {
      const { pool } = getDatabase({ debug: false });
      pool.on("error", () => {});
      pool.options.max = 3;
      pool.options.connectionTimeoutMillis = 3000;
      pool.options.idleTimeoutMillis = 10000;
      return new PaymentRepository(pool);
    }).catch(error => { repositoryPromise = undefined; throw error; });
    return repositoryPromise;
  },
};
export const handlers = createHandlers(dependencies);
export const paymentHandlers = createPaymentHandlers(dependencies);
