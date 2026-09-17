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
const publicFiles = await files(publicRoot);
for (const file of publicFiles) {
  assert(!/(?:^|[\\/])\.|\.(?:sql|env|pem|key|map|mjs)$/i.test(relative(publicRoot, file)), "Arquivo privado na pasta pública");
  if (!/\.(?:html|css|js|json|txt)$/i.test(file)) continue;
  const text = await readFile(file, "utf8");
  assert(!/PAGBANK_API_TOKEN|CHECKOUT_ABUSE_SECRET|NETLIFY_DB_|@netlify\/database|@electric-sql|process\.env|postgres(?:ql)?:\/\/|Bearer\s+[A-Za-z0-9_-]{12}|-----BEGIN.*PRIVATE KEY|\.\.[/\\]server/i.test(text), "Indício de segredo ou import privado no conteúdo público");
}
for (const file of publicFiles.filter(file => file.endsWith(".html"))) {
  const html = await readFile(file, "utf8");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, "IDs HTML duplicados");
  for (const [, target] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^https?:/.test(target)) continue;
    const [pathname, anchor] = target.split("#");
    const path = pathname ? resolve(dirname(file), pathname.split("?")[0]) : file;
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
console.log(`Estrutura, sintaxe, âncoras e ${publicFiles.length} arquivos públicos verificados; varredura heurística sem indícios de segredos.`);
