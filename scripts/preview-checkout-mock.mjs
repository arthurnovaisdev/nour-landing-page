import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { dirname, resolve, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { testDatabase, testEnv } from "../tests/checkout-fixtures.mjs";
import { PaymentRepository } from "../server/payments/payment-repository.mjs";
import { createPaymentHandlers } from "../server/payments/confirmation.mjs";
import { createHandlers } from "../server/payments/checkout.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = resolve(root, "dist");
await mkdir(resolve(root, ".qa"), { recursive: true });
const { db, pool } = await testDatabase(resolve(root, ".qa/checkout-mock-postgres"));
const repository = new PaymentRepository(pool);
const handlers = createHandlers({
  env: () => ({ ...testEnv }), // Nunca lê token ou .env da máquina.
  getRepository: async () => repository,
  fetcher: async () => { throw new Error("NETWORK_FORBIDDEN_IN_MOCK_PREVIEW"); },
});
const payments = createPaymentHandlers({ env: () => ({ ...testEnv }), getRepository: async () => repository,
  fetcher: async () => { throw new Error("NETWORK_FORBIDDEN_IN_MOCK_PREVIEW"); } });
const address = "http://127.0.0.1:8766";
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".png": "image/png" };
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, address);
    if (url.pathname.startsWith("/api/")) {
      if (!["/api/checkouts", "/api/checkout-session", "/api/orders/status", "/api/orders/retry"].includes(url.pathname)) {
        res.writeHead(503); res.end(); return;
      }
      let size = 0; const parts = [];
      for await (const part of req) {
        size += part.length;
        if (size > 1024) { res.writeHead(413); res.end(); return; }
        parts.push(part);
      }
      const headers = new Headers(req.headers);
      // Ponte exclusiva de loopback para exercitar a validação HTTPS das Functions.
      // Só traduz a origem local exata; origem ausente ou externa continua recusada.
      if (headers.get("origin") === address) headers.set("origin", testEnv.SITE_ORIGIN);
      const method = req.method;
      const request = new Request(testEnv.SITE_ORIGIN + url.pathname + url.search, {
        method, headers, ...(["GET","HEAD"].includes(method) ? {} : { body: Buffer.concat(parts) }),
      });
      const handler = { "/api/checkouts": handlers.checkout, "/api/checkout-session": handlers.session,
        "/api/orders/status": payments.status, "/api/orders/retry": payments.retry }[url.pathname];
      const result = await handler(request, { ip: "127.0.0.1" });
      res.writeHead(result.status, Object.fromEntries(result.headers));
      res.end(await result.text());
      return;
    }
    if (!["GET","HEAD"].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const target = resolve(publicDir, "." + decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
    const rel = relative(publicDir, target);
    if (rel.startsWith("..") || rel.split(/[\\/]/).some(part => part.startsWith("."))) { res.writeHead(404); res.end(); return; }
    const bytes = await readFile(target);
    res.writeHead(200, { "Content-Type": types[extname(target)] || "application/octet-stream",
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    res.end(req.method === "HEAD" ? undefined : bytes);
  } catch { res.writeHead(503); res.end(); }
});
server.listen(8766, "127.0.0.1", () => console.log("Prévia local mock: " + address + " — sem rede PagBank."));
async function close() { server.close(); await db.close(); process.exit(0); }
process.on("SIGINT", close);
process.on("SIGTERM", close);
