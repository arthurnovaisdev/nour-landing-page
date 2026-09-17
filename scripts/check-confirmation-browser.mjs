import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
await mkdir(".qa", { recursive: true });
const require = createRequire(process.env.NOUR_QA_PACKAGE_JSON || import.meta.url);
const { chromium } = require("playwright");
const browser = await chromium.launch({ headless: true, ...(process.env.NOUR_QA_BROWSER ? { executablePath: process.env.NOUR_QA_BROWSER } : {}) });
const base = process.env.NOUR_QA_URL || "http://127.0.0.1:8766";
assert(["127.0.0.1", "localhost"].includes(new URL(base).hostname), "QA somente em loopback");
const errors = [], observations = [];
try {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  let state = "WAITING", reply = 200, queryCount = 0, external = 0;
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) { if (url.hostname !== "me.kis.v2.scr.kaspersky-labs.com") external++;
      // Injeção do antivírus local também é abortada; não pertence ao código do site.
      return route.abort(); }
    if (url.pathname === "/api/orders/status") {
      queryCount++;
      assert.equal(url.search, "");
      return route.fulfill({ status: reply, contentType: "application/json", body: JSON.stringify(reply === 200
        ? { state, canRetry: ["DECLINED","CANCELED","EXPIRED"].includes(state), access: "BLOCKED", mode: "sandbox" }
        : { error: "SESSION_UNAVAILABLE" }) });
    }
    if (url.pathname === "/api/orders/retry") return route.fulfill({ status: 200, contentType: "application/json", body: '{"checkoutUrl":null}' });
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  await page.bringToFront();
  page.on("pageerror", e => errors.push(e.message));
  for (const width of [1440,1024,768,390,320]) {
    await page.setViewportSize({ width, height: 900 });
    state = "WAITING";
    await page.goto(base + "/checkout-return.html?status=PAID&amount=1#PAID", { waitUntil: "domcontentloaded" });
    for (const [value, label] of [["WAITING","Aguardando pagamento"],["IN_ANALYSIS","Pagamento em análise"],
      ["PAID","Pagamento confirmado"],["DECLINED","Pagamento recusado"],["CANCELED","Pagamento cancelado"],
      ["EXPIRED","Checkout expirado"],["TEMPORARY_ERROR","Erro temporário"],["BLOCKED","Pagamento em revisão"]]) {
      state = value;
      await page.locator("#payment-refresh").click();
      await page.getByRole("heading", { level: 1, name: label, exact: true }).waitFor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.equal(await page.locator('a[href*="wa.me"],a[href*="whatsapp"],a[href*="chat.whatsapp"]').count(), 0);
      assert.equal(await page.locator("#payment-retry").isVisible(), ["DECLINED","CANCELED","EXPIRED"].includes(value));
      assert.equal(await page.locator("[role=status]").getAttribute("aria-live"), "polite");
      if ((width === 1440 || width === 320) && ["WAITING","PAID","TEMPORARY_ERROR"].includes(value))
        await page.screenshot({ path: `.qa/confirmation-${value}-${width}.png`, fullPage: true });
      observations.push({ width, state: value, overflow: false });
    }
  }
  reply = 401;
  await page.goto(base + "/checkout-return.html");
  await page.getByRole("heading", { name: "Sessão indisponível" }).waitFor();
  assert.equal(await page.locator("#payment-retry").isVisible(), false);
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), "Pular para o conteúdo");
  reply = 200; state = "EXPIRED";
  await page.goto(base + "/checkout-return.html");
  await page.getByRole("button", { name: "Tentar pagamento novamente" }).click();
  await page.waitForURL("**/index.html#planos");
  assert.equal(external, 0); assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks: observations.length, viewports: [1440,1024,768,390,320], errors, external, queryCount, keyboard: "passed", safeRetry: "passed" }));
} catch (error) { console.log("UI_FAILURE", error.message); throw error; } finally { await browser.close(); }



