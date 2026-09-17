import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { CheckoutRepository } from "../server/payments/repository.mjs";
import { createHandlers } from "../server/payments/checkout.mjs";
import { configuration } from "../server/payments/input.mjs";

export const testEnv = {
  PAGBANK_ENVIRONMENT: "sandbox", SITE_ORIGIN: "https://nour.test",
  CHECKOUT_ABUSE_SECRET: "test-only-abuse-secret-with-32-characters",
};
export const context = { ip: "203.0.113.20" };

// Postgres WASM isolado, exclusivamente nos testes/preview. Nunca nas Functions.
export async function testDatabase(dataDir) {
  const db = new PGlite(dataDir);
  const exists = await db.query("SELECT to_regclass('public.nour_orders') AS name");
  if (!exists.rows[0].name) {
    for (const file of ["202609160001_payment_foundation.sql", "202609160002_sandbox_checkout.sql"]) {
      await db.exec((await readFile(new URL("../netlify/database/migrations/" + file, import.meta.url), "utf8")).replace(/^\uFEFF/, ""));
    }
  }
  // PGlite tem uma conexão. O gate preserva BEGIN/COMMIT na mesma conexão.
  // Exercita concorrência HTTP, mas não substitui teste multiconexão do Postgres remoto.
  let tail = Promise.resolve();
  const pool = { async connect() {
    const previous = tail;
    let release;
    tail = new Promise(resolve => { release = resolve; });
    await previous;
    return { query: (sql, params) => db.query(sql, params), release };
  } };
  return { db, pool };
}
export async function fixture({ env = {}, fetcher, clock } = {}) {
  const { db, pool } = await testDatabase();
  const settings = { ...testEnv, ...env };
  let now = Date.now();
  const repository = new CheckoutRepository(pool, clock || (() => new Date(now)));
  let calls = 0;
  const handlers = createHandlers({
    env: () => settings, getRepository: async () => repository,
    fetcher: async (...args) => { calls++; return fetcher(...args); },
  });
  return { db, repository, handlers, settings,
    get calls() { return calls; }, advance(ms) { now += ms; },
    async close() { await db.close(); },
  };
}
export function request(path, body = {}, { cookie, key, headers = {}, method = "POST" } = {}) {
  return new Request(testEnv.SITE_ORIGIN + path, {
    method, headers: {
      Origin: testEnv.SITE_ORIGIN, "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin",
      ...(cookie ? { Cookie: cookie } : {}), ...(key ? { "Idempotency-Key": key } : {}), ...headers,
    }, ...(["GET", "HEAD"].includes(method) ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
}
export async function session(f, ctx = context) {
  const response = await f.handlers.session(request("/api/checkout-session"), ctx);
  if (response.status !== 200) throw new Error("FIXTURE_SESSION_FAILED");
  return response.headers.get("set-cookie").split(";")[0];
}
export function gatewayResponse(payload, patch = {}) {
  return Response.json({
    id: "CHEC_5fc1c0dd-1436-4d5b-bc40-2eb57f74d2d9",
    reference_id: payload.reference_id, status: "ACTIVE", expiration_date: payload.expiration_date,
    items: payload.items, additional_amount: 0, discount_amount: 0,
    links: [{ rel: "PAY", method: "GET", href: "https://sandbox.pagamento.pagseguro.uol.com.br/pagamento?code=fixture-test-only" }],
    ...patch,
  });
}
export { configuration };
