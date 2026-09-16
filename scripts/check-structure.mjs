import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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
assert.match(config, /directory\s*=\s*"netlify\/functions"/);
const publicFiles = await files(resolve(root, "dist"));
for (const file of publicFiles) {
  assert(!/(?:^|[\\/])\.|\.(?:sql|env|pem|key|map|mjs)$/i.test(relative(resolve(root, "dist"), file)), "Arquivo privado na pasta pública");
  if (!/\.(?:html|css|js|json|txt)$/i.test(file)) continue;
  const text = await readFile(file, "utf8");
  assert(!/PAGBANK_API_TOKEN|process\.env|postgres(?:ql)?:\/\/|Bearer\s+[A-Za-z0-9_-]{12}|-----BEGIN.*PRIVATE KEY|\.\.[/\\]server/i.test(text), "Indício de segredo ou import privado no conteúdo público");
}
const html = await readFile(resolve(root, "dist/index.html"), "utf8");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(new Set(ids).size, ids.length, "IDs HTML duplicados");
for (const [, target] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
  if (target.startsWith("#")) assert(ids.includes(target.slice(1)), "Âncora sem destino");
  else if (!/^https?:/.test(target)) {
    const path = resolve(root, "dist", target);
    assert(!relative(resolve(root, "dist"), path).startsWith(".."));
    assert((await stat(path)).isFile(), "Ativo local ausente");
  }
}
for (const directory of ["server", "netlify/functions", "tests", "scripts"]) {
  for (const file of await files(resolve(root, directory))) {
    if (!file.endsWith(".mjs")) continue;
    const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    assert.equal(result.status, 0, `Sintaxe inválida: ${relative(root, file)}`);
  }
}
console.log(`Estrutura, sintaxe, âncoras e ${publicFiles.length} arquivos públicos verificados; varredura heurística sem indícios de segredos.`);
