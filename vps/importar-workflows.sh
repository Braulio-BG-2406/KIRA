#!/usr/bin/env bash
# Importa no n8n da VPS os workflows baixados do n8n Cloud (⋯ → Download), mantendo os mesmos IDs, para as
# ligações entre a Kira e os sub-workflows continuarem valendo. Tudo entra despublicado (nada roda sozinho).
# Antes, copie os .json para /opt/kira/importar na VPS. Uso (como root): bash importar-workflows.sh
set -euo pipefail

PASTA=/opt/kira/importar
cd /opt/kira

shopt -s nullglob
ARQUIVOS=("$PASTA"/*.json)
if [ "${#ARQUIVOS[@]}" -eq 0 ]; then
  echo "Nenhum arquivo .json em $PASTA."
  exit 1
fi
echo "==> ${#ARQUIVOS[@]} arquivo(s) para importar"

# Copia para dentro do container e marca cada workflow como despublicado. Pula o que não veio do Download do
# n8n (sem ID, como os .json deste repositório) e as cópias repetidas ("(1)" no nome).
docker compose exec -T -u root n8n rm -rf /tmp/importar
docker compose cp "$PASTA" n8n:/tmp/importar
docker compose exec -T -u root n8n node -e '
const fs = require("fs");
const dir = "/tmp/importar";
const vistos = new Set();
for (const arquivo of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const caminho = `${dir}/${arquivo}`;
  let w = null;
  try { w = JSON.parse(fs.readFileSync(caminho, "utf8")); } catch {}
  if (!w || !w.id || vistos.has(w.id)) {
    fs.unlinkSync(caminho);
    console.log(`pulado: ${arquivo} (${!w ? "não é um workflow" : !w.id ? "sem ID: não veio do Download do n8n" : "repetido"})`);
    continue;
  }
  vistos.add(w.id);
  w.active = false;
  fs.writeFileSync(caminho, JSON.stringify(w));
  console.log(`${w.id}  ${w.name}`);
}
if (!vistos.size) {
  console.log("Nenhum workflow para importar.");
  process.exit(1);
}
console.log(`${vistos.size} workflow(s) para importar`);
'
docker compose exec -T -u root n8n chmod -R a+r /tmp/importar

echo "==> Importando"
docker compose exec -T n8n n8n import:workflow --separate --input=/tmp/importar

echo "==> Workflows no n8n da VPS"
docker compose exec -T n8n n8n list:workflow
