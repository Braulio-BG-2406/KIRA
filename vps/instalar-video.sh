#!/usr/bin/env bash
# Instala o serviço de vídeo da Kira (faixa com texto nos Reels) na VPS, ao lado do n8n do instalar.sh.
# Rode como root, passando o endereço da pasta vps/video deste repositório (versão "raw" do GitHub):
#   bash instalar-video.sh https://raw.githubusercontent.com/<dono>/<repositório>/<ramo>/vps/video
# O serviço não abre nenhuma porta na internet: só o n8n fala com ele (http://kira-video:8080).
# Cabe numa VPS pequena (2 GB de memória): usa no máximo 1 processador e 512 MB, um vídeo por vez.
# Pode rodar de novo para atualizar.
set -euo pipefail

BASE="${1:-}"
PASTA=/opt/kira

if [ -z "$BASE" ]; then
  echo "Uso: bash instalar-video.sh <endereço raw da pasta vps/video>"
  exit 1
fi
if [ "$(id -u)" != 0 ]; then
  echo "Rode como root."
  exit 1
fi
if [ ! -f "$PASTA/docker-compose.yml" ]; then
  echo "Não achei o n8n em $PASTA. Rode antes o instalar.sh."
  exit 1
fi

echo "==> 1/3 Baixando os arquivos"
mkdir -p "$PASTA/video"
curl -fsSL "$BASE/Dockerfile" -o "$PASTA/video/Dockerfile"
curl -fsSL "$BASE/servidor.py" -o "$PASTA/video/servidor.py"

# O docker-compose.override.yml é lido junto com o docker-compose.yml e não é apagado quando o instalar.sh roda de
# novo.
cat > "$PASTA/docker-compose.override.yml" <<'YAML'
services:
  kira-video:
    build: ./video
    restart: unless-stopped
    cpus: 1.0
    mem_limit: 512m
    read_only: true
    tmpfs:
      - /tmp:size=300m
    environment:
      - PORTA=8080
      - HOME=/tmp
YAML

echo "==> 2/3 Montando e subindo o serviço (a primeira vez leva alguns minutos)"
cd "$PASTA"
docker compose build kira-video
docker compose up -d kira-video

echo "==> 3/3 Conferindo"
for _ in $(seq 1 20); do
  if docker compose exec -T kira-video python3 -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8080/saude').read().decode())" 2>/dev/null | grep -q ok; then
    echo
    echo "PRONTO! O serviço de vídeo da Kira está no ar (só para o n8n, em http://kira-video:8080)."
    exit 0
  fi
  sleep 3
done
echo
echo "O serviço não respondeu. Últimas linhas:"
docker compose logs --tail=25 kira-video
exit 1
