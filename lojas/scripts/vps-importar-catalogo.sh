#!/bin/bash
# Importa na VPS o catálogo trazido do site antigo da Infinite (pasta migracao-infinite/ do repositório):
# 469 peças com opções, códigos, preços, estoque e fotos. Pode rodar de novo: o que já existe é pulado.
#
#   bash vps-importar-catalogo.sh [slug-da-loja] [--atualizar]
#
# Precisa das lojas já instaladas e atualizadas (instalar-vps.sh), porque usa o script novo da imagem.
set -euo pipefail
PASTA=${PASTA:-/opt/kira-lojas}
LOJA=${1:-infinite}
EXTRA=${2:-}
DADOS=${DADOS:-$PASTA/migracao-infinite}

[ -f "$DADOS/catalogo/catalogo.json" ] || { echo "Não achei $DADOS/catalogo/catalogo.json. Rode antes o instalador com a versão nova do código."; exit 1; }
cd "$PASTA/lojas"
[ -f scripts/importar-catalogo.ts ] || { echo "O código em $PASTA ainda é o antigo. Rode antes o instalador (instalar-lojas.sh)."; exit 1; }

# o mesmo volume de fotos que o site usa
APP=$(docker compose ps -q app)
[ -n "$APP" ] || { echo "As lojas não estão rodando. Rode antes o instalador."; exit 1; }
VOL=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/uploads"}}{{.Name}}{{end}}{{end}}' "$APP")
[ -n "$VOL" ] || { echo "Não achei o volume das fotos do container das lojas."; exit 1; }

echo "Importando o catálogo na loja \"$LOJA\" (fotos no volume $VOL)..."
docker compose run --rm -T -v "$DADOS:/importar:ro" -v "$VOL:/app/uploads" -e UPLOAD_DIR=/app/uploads \
  migrar npx tsx scripts/importar-catalogo.ts "$LOJA" /importar $EXTRA
# a imagem do migrar roda como root: o site (usuário app) precisa conseguir ler e apagar as fotos
docker compose exec -T -u root app sh -c 'chown -R app:app /app/uploads' || true
echo "Pronto! Confira em: $(grep -E '^APP_URL=' .env | cut -d= -f2-)/loja/$LOJA/catalogo"
