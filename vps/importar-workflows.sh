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

# Copia para dentro do container e marca cada workflow como despublicado.
docker compose exec -T -u root n8n rm -rf /tmp/importar
docker compose cp "$PASTA" n8n:/tmp/importar
docker compose exec -T -u root n8n node -e '
const fs = require("fs");
const dir = "/tmp/importar";
for (const arquivo of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const w = JSON.parse(fs.readFileSync(`${dir}/${arquivo}`, "utf8"));
  w.active = false;
  fs.writeFileSync(`${dir}/${arquivo}`, JSON.stringify(w));
  console.log(`${w.id || "(sem id: o n8n vai criar um novo)"}  ${w.name}`);
}
'
docker compose exec -T -u root n8n chmod -R a+r /tmp/importar

echo "==> Importando"
docker compose exec -T n8n n8n import:workflow --separate --input=/tmp/importar

echo "==> Workflows no n8n da VPS"
docker compose exec -T n8n n8n list:workflow
