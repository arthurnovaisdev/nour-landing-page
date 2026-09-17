import { createHandlers } from "./checkout.mjs";
import { CheckoutRepository } from "./repository.mjs";

let repositoryPromise;
// Somente o pool é reutilizado. Pedidos, sessões e limites sempre ficam no Postgres.
export const handlers = createHandlers({
  env: () => process.env,
  getRepository() {
    repositoryPromise ??= import("@netlify/database").then(({ getDatabase }) => {
      const { pool } = getDatabase({ debug: false });
      pool.on("error", () => { /* O pool descarta a conexão; não registrar erro/DSN. */ });
      pool.options.max = 3;
      pool.options.connectionTimeoutMillis = 3000;
      pool.options.idleTimeoutMillis = 10000;
      return new CheckoutRepository(pool);
    }).catch(error => { repositoryPromise = undefined; throw error; });
    return repositoryPromise;
  },
});
