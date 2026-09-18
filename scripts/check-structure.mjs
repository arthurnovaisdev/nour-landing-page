import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = resolve(root, "dist");
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    assert(!entry.isSymbolicLink(), "Link simbólico não permitido na fronteira pública");
    if (entry.isDirectory()) result.push(...await files(path));
    else result.push(path);
  }
  return result;
}
const config = await readFile(resolve(root, "netlify.toml"), "utf8");
assert.match(config, /publish\s*=\s*"dist"/);
assert.doesNotMatch(config, /\[functions\]|\/api\//);
for (const header of [
  "Content-Security-Policy",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
  "Permissions-Policy",
  "Referrer-Policy",
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "X-Frame-Options",
]) {
  assert(config.includes(header), "Cabeçalho de segurança ausente: " + header);
}
assert.match(config, /script-src 'self'/);
assert.match(config, /style-src 'self'/);
assert.doesNotMatch(config, /unsafe-inline|unsafe-eval/);
const commercialConfig = await readFile(resolve(publicRoot, "assets/scripts/config.js"), "utf8");
const expectedPayments = {
  monthlyPaymentUrl: "https://pag.ae/82an7DjHH",
  semiannualPaymentUrl: "https://pag.ae/82an7kw61",
  annualPaymentUrl: "https://pag.ae/82an6e-Kn",
};
for (const [property, url] of Object.entries(expectedPayments)) {
  assert(commercialConfig.includes(`${property}: "${url}"`), "Link de Pagamento incorreto: " + property);
}
assert(commercialConfig.includes('instagramUrl: "https://instagram.com/sam_seza"'));
assert(commercialConfig.includes('contactEmail: "contato@nourcrypto.com.br"'));
assert.match(commercialConfig, /whatsappNumber:\s*"\d{10,15}"/);
assert.doesNotMatch(commercialConfig, /PAGBANK_TOKEN|Authorization|Bearer|secret|password/i);
const paymentScript = await readFile(resolve(publicRoot, "assets/scripts/payments.js"), "utf8");
for (const [plan, property] of Object.entries({ monthly: "monthlyPaymentUrl", semiannual: "semiannualPaymentUrl", annual: "annualPaymentUrl" })) {
  assert(paymentScript.includes(`${plan}: "${property}"`), "CTA associado à configuração incorreta: " + plan);
}
assert.doesNotMatch(paymentScript, /location\.search|URLSearchParams/, "Parâmetros da landing não podem controlar o pagamento");
const publicFiles = await files(publicRoot);
for (const file of publicFiles) {
  assert(!/(?:^|[\\/])\.|\.(?:sql|env|pem|key|map|mjs)$/i.test(relative(publicRoot, file)), "Arquivo privado na pasta pública");
  if (!/\.(?:html|css|js|json|txt)$/i.test(file)) continue;
  const text = await readFile(file, "utf8");
  assert(!/PAGBANK_API_TOKEN|CHECKOUT_ABUSE_SECRET|NETLIFY_DB_|@netlify\/database|@electric-sql|process\.env|postgres(?:ql)?:\/\/|Bearer\s+[A-Za-z0-9_-]{12}|-----BEGIN.*PRIVATE KEY|\.\.[/\\]server/i.test(text), "Indício de segredo ou import privado no conteúdo público");
  if (file.endsWith(".js")) {
    assert.doesNotMatch(text, /location\.search|URLSearchParams|document\.URL/i, "Parâmetros da URL não podem controlar configuração pública");
  }
}
for (const file of publicFiles.filter(file => file.endsWith(".html"))) {
  const html = await readFile(file, "utf8");
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i, "Script inline incompatível com a CSP");
  assert.doesNotMatch(html, /\sstyle\s*=/i, "Estilo inline incompatível com a CSP");
  for (const [tag] of html.matchAll(/<img\b[^>]*>/gi)) {
    assert.match(tag, /\balt="[^"]*"/, "Imagem sem texto alternativo explícito");
    assert.match(tag, /\bwidth="\d+"/, "Imagem sem largura intrínseca");
    assert.match(tag, /\bheight="\d+"/, "Imagem sem altura intrínseca");
  }
  for (const [tag] of html.matchAll(/<a\b[^>]*\btarget="_blank"[^>]*>/gi)) {
    assert.match(tag, /\brel="[^"]*\bnoopener\b[^"]*"/, "Link externo sem noopener");
    assert.match(tag, /\brel="[^"]*\bnoreferrer\b[^"]*"/, "Link externo sem noreferrer");
  }
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, "IDs HTML duplicados");
  for (const [, target] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    const [pathname, anchor] = target.split("#");
    const candidate = pathname ? resolve(dirname(file), pathname.split("?")[0]) : file;
    const candidateStat = await stat(candidate);
    const path = candidateStat.isDirectory() ? resolve(candidate, "index.html") : candidate;
    assert(!relative(publicRoot, path).startsWith(".."), "Link fora da pasta pública");
    assert((await stat(path)).isFile(), "Ativo local ausente");
    if (anchor) {
      const targetHtml = await readFile(path, "utf8");
      const targetIds = [...targetHtml.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
      assert(targetIds.includes(anchor), "Âncora sem destino");
    }
  }
}
for (const directory of ["scripts", "dist/assets/scripts"]) {
  for (const file of await files(resolve(root, directory))) {
    if (!/\.(?:mjs|js)$/.test(file)) continue;
    const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    assert.equal(result.status, 0, `Sintaxe inválida: ${relative(root, file)}`);
  }
}
const thankYouPage = await readFile(resolve(publicRoot, "obrigado/index.html"), "utf8");
const landingPage = await readFile(resolve(publicRoot, "index.html"), "utf8");
const termsPage = await readFile(resolve(publicRoot, "termos-de-uso/index.html"), "utf8");
const privacyPage = await readFile(resolve(publicRoot, "politica-de-privacidade/index.html"), "utf8");
const robots = await readFile(resolve(publicRoot, "robots.txt"), "utf8");
const sitemap = await readFile(resolve(publicRoot, "sitemap.xml"), "utf8");
assert(landingPage.includes("Instagram · @sam_seza"));
assert(landingPage.includes("mailto:contato@nourcrypto.com.br"));
assert(!/em breve|em revisão/i.test(landingPage));
assert(landingPage.includes("Ao escolher um plano, você será direcionado ao PagBank para concluir o pagamento."));
assert(landingPage.includes("sem necessidade de enviar comprovante ou avisar que pagou."));
for (const [plan, price] of Object.entries({ monthly: "100", semiannual: "500", annual: "900" })) {
  assert.match(landingPage, new RegExp(`class="price"[^>]*><small>R\\$<\\/small>\\s*${price}<`), "Preço incorreto: " + plan);
  assert.equal([...landingPage.matchAll(new RegExp(`data-payment-plan="${plan}"`, "g"))].length, 1, "CTA duplicado ou ausente: " + plan);
}
for (const [plan, track, url] of [
  ["monthly", "plan-monthly", expectedPayments.monthlyPaymentUrl],
  ["semiannual", "plan-semiannual", expectedPayments.semiannualPaymentUrl],
  ["annual", "plan-annual", expectedPayments.annualPaymentUrl],
]) {
  assert.match(landingPage, new RegExp(`href="${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*data-payment-plan="${plan}"[^>]*data-track="${track}"`), "CTA rastreável ausente: " + plan);
}
assert.equal([...landingPage.matchAll(/<h1\b/gi)].length, 1, "A landing page deve ter exatamente um H1");
assert.match(landingPage, /<html lang="pt-BR">/);
assert.match(landingPage, /<meta name="viewport" content="width=device-width, initial-scale=1" \/>/);
assert.match(landingPage, /<meta\s+name="description"\s+content="[^"]+"/);
assert(termsPage.includes("não garante rentabilidade"));
assert(termsPage.includes("mailto:contato@nourcrypto.com.br"));
for (const service of ["Netlify", "PagBank", "WhatsApp", "Instagram"]) {
  assert(privacyPage.includes(service), "Serviço externo ausente na Política de Privacidade: " + service);
}
assert(privacyPage.includes("mailto:contato@nourcrypto.com.br"));
assert.match(landingPage, /<link rel="canonical" href="https:\/\/nourcrypto\.com\.br\/" \/>/);
for (const property of ["og:type", "og:title", "og:description", "og:url", "og:site_name"]) {
  assert.match(landingPage, new RegExp(`<meta property="${property}" content="[^"]+" \\/>`), "Open Graph ausente: " + property);
}
for (const name of ["twitter:card", "twitter:title", "twitter:description"]) {
  assert.match(landingPage, new RegExp(`<meta name="${name}" content="[^"]+" \\/>`), "Twitter card ausente: " + name);
}
assert.doesNotMatch(landingPage, /noindex|nofollow/i);
assert.match(thankYouPage, /<link rel="canonical" href="https:\/\/nourcrypto\.com\.br\/obrigado" \/>/);
assert.match(thankYouPage, /<meta property="og:url" content="https:\/\/nourcrypto\.com\.br\/obrigado" \/>/);
assert.match(thankYouPage, /<meta name="robots" content="noindex, follow" \/>/);
assert.match(thankYouPage, /Acessá-la não confirma nem comprova um pagamento/);
assert.match(thankYouPage, /Você não precisa enviar comprovante nem avisar/);
assert.doesNotMatch(thankYouPage, /status\s+PAID|código de pedido|grupo\.whatsapp|chat\.whatsapp/i);
assert.match(robots, /^User-agent: \*$/m);
assert.match(robots, /^Allow: \/$/m);
assert.match(robots, /^Sitemap: https:\/\/nourcrypto\.com\.br\/sitemap\.xml$/m);
assert.doesNotMatch(robots, /Disallow:\s*\/obrigado/i);
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url);
assert.deepEqual(sitemapUrls, [
  "https://nourcrypto.com.br/",
  "https://nourcrypto.com.br/termos-de-uso/",
  "https://nourcrypto.com.br/politica-de-privacidade/",
]);
assert.doesNotMatch(sitemap, /\/obrigado\/?</i);
for (const track of ["plan-monthly", "plan-semiannual", "plan-annual", "whatsapp"]) {
  assert(landingPage.includes(`data-track="${track}"`), "Identificador de tracking ausente: " + track);
}
console.log(`Estrutura, sintaxe, âncoras e ${publicFiles.length} arquivos públicos verificados; varredura heurística sem indícios de segredos.`);
