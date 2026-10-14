#!/usr/bin/env bash
# Instala o WAHA (o WhatsApp da Kira) na VPS, ao lado do n8n, e cria no n8n a credencial "WAHA (Kira)".
#
# Uso, na VPS, como root:
#   curl -fsSL https://raw.githubusercontent.com/Braulio-BG-2406/KIRA/claude/tender-heisenberg-0xlacs/whatsapp/instalar.sh -o instalar.sh
#   bash instalar.sh
#
# Pode rodar de novo quando quiser: reaproveita a chave e só atualiza o que mudou.
# O WAHA fica só na rede interna do Docker (sem porta aberta para a internet): só o n8n fala com ele.
set -euo pipefail

PASTA=/opt/kira-whatsapp
IMAGEM=devlikeapro/waha:gows-2026.9.2
CONTAINER=kira-whatsapp
CRED_ID=0KTSAUw698tt2RST
CRED_NOME="WAHA (Kira)"
PROJETO_N8N=uXMLYvK3IaOkSnqv

ok() { printf '\033[32m✔ %s\033[0m\n' "$*"; }
aviso() { printf '\033[33m! %s\033[0m\n' "$*"; }
erro() { printf '\033[31m✘ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || erro "Rode como root (use: sudo bash instalar.sh)."
command -v docker >/dev/null || erro "Não achei o Docker nesta VPS. O n8n roda em Docker? Mande este erro para o Claude."
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null; then
  COMPOSE="docker-compose"
else
  erro "Não achei o docker compose. Mande este erro para o Claude."
fi
case "$(uname -m)" in
  x86_64 | amd64) ;;
  *) erro "Esta VPS é $(uname -m); a imagem do WAHA usada aqui é só para x86_64. Mande este erro para o Claude." ;;
esac

# 1. Acha o container do n8n e a rede Docker dele (o WAHA entra na mesma rede).
N8N=$(docker ps --format '{{.Names}} {{.Image}}' | awk 'tolower($2) ~ /n8n/ && tolower($2) !~ /runner|worker/ {print $1; exit}')
[ -n "$N8N" ] || erro "Não achei o container do n8n rodando (docker ps). Mande este erro para o Claude."
ok "n8n encontrado: $N8N"
REDE=$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' "$N8N" | grep -v -E '^(bridge|host|none)?$' | head -n1 || true)
if [ -z "$REDE" ]; then
  # n8n só na rede padrão do Docker, onde um container não acha o outro pelo nome: cria uma rede para os dois.
  REDE=kira-rede
  docker network inspect "$REDE" >/dev/null 2>&1 || docker network create "$REDE" >/dev/null
  docker network connect "$REDE" "$N8N" 2>/dev/null || true
  aviso "Criei a rede $REDE e liguei o n8n nela. Se o n8n for recriado, rode este instalador de novo."
fi
ok "Rede Docker: $REDE"

# 2. Chave de acesso do WAHA: gera uma vez e reaproveita nas próximas.
mkdir -p "$PASTA"
chmod 700 "$PASTA"
CHAVE=""
[ -f "$PASTA/.env" ] && CHAVE=$(grep -E '^WAHA_API_KEY=' "$PASTA/.env" | cut -d= -f2- || true)
[ -n "$CHAVE" ] || CHAVE=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
umask 077
cat >"$PASTA/.env" <<EOF
WAHA_API_KEY=$CHAVE
REDE_N8N=$REDE
EOF

cat >"$PASTA/docker-compose.yml" <<EOF
# WAHA (WhatsApp HTTP API, versão Core, gratuita): o WhatsApp da Kira.
# Gerado por whatsapp/instalar.sh no repositório KIRA. Para atualizar, troque a versão da imagem e rode de novo.
services:
  $CONTAINER:
    image: $IMAGEM
    container_name: $CONTAINER
    restart: unless-stopped
    environment:
      WAHA_API_KEY: \${WAHA_API_KEY}
      WHATSAPP_DEFAULT_ENGINE: GOWS
      WHATSAPP_RESTART_ALL_SESSIONS: "True"
      WAHA_PRINT_QR: "False"
      WAHA_DASHBOARD_ENABLED: "False"
      WHATSAPP_SWAGGER_ENABLED: "False"
      WHATSAPP_DOWNLOAD_MEDIA: "False"
      WAHA_LOG_LEVEL: info
      TZ: America/Sao_Paulo
    volumes:
      - ./sessions:/app/.sessions
      - ./media:/app/.media
    networks:
      - rede_n8n
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: "3"
networks:
  rede_n8n:
    external: true
    name: \${REDE_N8N}
EOF
ok "Arquivos em $PASTA"

# 3. Sobe o WAHA.
echo "Baixando e ligando o WAHA (a primeira vez demora alguns minutos)..."
(cd "$PASTA" && $COMPOSE pull -q && $COMPOSE up -d)
ok "WAHA ligado ($CONTAINER)"

# 4. Confere se o n8n enxerga o WAHA pela rede interna.
printf 'Esperando o WAHA responder'
PRONTO=""
for _ in $(seq 1 40); do
  if docker exec "$N8N" wget -q -O /dev/null --header "X-Api-Key: $CHAVE" "http://$CONTAINER:3000/api/sessions" 2>/dev/null; then
    PRONTO=1
    break
  fi
  printf '.'
  sleep 3
done
echo
if [ -n "$PRONTO" ]; then
  ok "O n8n já fala com o WAHA."
else
  aviso "O n8n ainda não conseguiu falar com o WAHA. Veja o log com: docker logs --tail 50 $CONTAINER"
fi

# 5. Cria (ou atualiza) a credencial "WAHA (Kira)" no n8n, com a mesma chave.
CRED_JSON=$(printf '[{"id":"%s","name":"%s","type":"httpHeaderAuth","data":{"name":"X-Api-Key","value":"%s"}}]' "$CRED_ID" "$CRED_NOME" "$CHAVE")
CRED_OK=""
if printf '%s' "$CRED_JSON" | docker exec -i "$N8N" sh -c 'umask 077; cat > /tmp/kira-waha-cred.json'; then
  if docker exec "$N8N" n8n import:credentials --input=/tmp/kira-waha-cred.json --projectId="$PROJETO_N8N" >/dev/null 2>&1 ||
    docker exec "$N8N" n8n import:credentials --input=/tmp/kira-waha-cred.json >/dev/null 2>&1; then
    CRED_OK=1
  fi
  docker exec "$N8N" rm -f /tmp/kira-waha-cred.json || true
fi

echo
if [ -n "$CRED_OK" ]; then
  ok "Credencial \"$CRED_NOME\" criada no n8n."
  echo
  echo "Pronto! Agora volte ao chat do Claude e diga: \"instalei o WAHA\"."
  echo "Ele liga a credencial nos workflows do WhatsApp; depois é só mandar /whatsapp para a Kira no Telegram."
else
  aviso "Não consegui criar a credencial no n8n sozinho. Crie à mão:"
  echo "  n8n > Credentials > Add credential > Header Auth"
  echo "  Nome da credencial: $CRED_NOME"
  echo "  Name: X-Api-Key"
  echo "  Value: a chave que está em $PASTA/.env (linha WAHA_API_KEY), com o comando:"
  echo "    grep WAHA_API_KEY $PASTA/.env"
  echo "Depois volte ao chat do Claude e diga: \"instalei o WAHA\"."
fi
