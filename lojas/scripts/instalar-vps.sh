#!/usr/bin/env bash
# Instala (ou atualiza) as lojas numa VPS que já tem Docker e um Caddy na frente,
# como a VPS da Kira (n8n + Caddy). Não mexe no n8n: só acrescenta um bloco no Caddyfile.
#
# Uso, como root:
#   curl -fsSL https://raw.githubusercontent.com/Braulio-BG-2406/KIRA/refs/heads/claude/trusting-davinci-9g9zzb/lojas/scripts/instalar-vps.sh -o instalar-lojas.sh
#   bash instalar-lojas.sh
#
# Rodar de novo atualiza o código e reinicia as lojas, sem perder dados.
# Enquanto não houver domínio próprio, as lojas ficam em endereços gratuitos do sslip.io
# montados com o IP da VPS (ex.: https://bgimports.177-153-67-118.sslip.io).
set -euo pipefail

REPO=${REPO:-https://github.com/Braulio-BG-2406/KIRA.git}
RAMO=${RAMO:-claude/trusting-davinci-9g9zzb}
PASTA=${PASTA:-/opt/kira-lojas}
MARCA="# lojas-kira"

passo() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
aviso() { printf '\033[33m%s\033[0m\n' "$*"; }
falha() { printf '\n\033[31mErro: %s\033[0m\n' "$*" >&2; exit 1; }
gerar() { (set +o pipefail; LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$1"); }

[ "$(id -u)" = 0 ] || falha "rode como root."
command -v docker >/dev/null || falha "Docker não encontrado nesta VPS."
docker compose version >/dev/null 2>&1 || falha "Docker Compose não encontrado nesta VPS."

passo "Procurando o Caddy que já atende o n8n"
# o Caddy que recebe a porta 443 (é ele que entrega o n8n com HTTPS)
CADDY=$(docker ps --filter publish=443 --format '{{.Names}} {{.Image}}' | awk '$2 ~ /(^|\/)caddy(:|$)/ {print $1; exit}')
[ -n "$CADDY" ] || falha "não achei nenhum container do Caddy rodando."
REDE=$(docker inspect "$CADDY" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' | awk '{print $1}')
CADDYFILE=$(docker inspect "$CADDY" --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}')
if [ -z "$CADDYFILE" ]; then
  DIR=$(docker inspect "$CADDY" --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy"}}{{.Source}}{{end}}{{end}}')
  [ -n "$DIR" ] && CADDYFILE="$DIR/Caddyfile"
fi
[ -n "$REDE" ] || falha "não achei a rede do container $CADDY."
[ -f "$CADDYFILE" ] || falha "não achei o Caddyfile do container $CADDY."
echo "Caddy: $CADDY · rede: $REDE · arquivo: $CADDYFILE"

IP=${IP:-$(curl -fsS --max-time 15 https://api.ipify.org || true)}
[[ "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || falha "não consegui descobrir o IP público da VPS."
BASE="$(tr . - <<<"$IP").sslip.io"
H_BG="bgimports.$BASE"
H_INF="infinite.$BASE"
H_PAINEL="painel.$BASE"

passo "Memória de reserva (swap)"
SWAP_MB=$(free -m | awk '/^Swap:/ {print $2}')
if [ "$SWAP_MB" -ge 2500 ] || swapon --show=NAME --noheadings 2>/dev/null | grep -q '/swapfile-lojas'; then
  echo "Já tem ${SWAP_MB} MB de swap."
else
  # a montagem da loja usa ~1 GB por alguns minutos; o swap evita apertar a Kira
  echo "Criando 2 GB de swap em /swapfile-lojas."
  if dd if=/dev/zero of=/swapfile-lojas bs=1M count=2048 status=none && chmod 600 /swapfile-lojas &&
    { chcon -t swapfile_t /swapfile-lojas 2>/dev/null || true; } && mkswap /swapfile-lojas >/dev/null && swapon /swapfile-lojas; then
    grep -q '^/swapfile-lojas ' /etc/fstab || echo '/swapfile-lojas none swap defaults 0 0' >>/etc/fstab
  else
    rm -f /swapfile-lojas
    aviso "Não consegui criar o swap. Sigo assim mesmo; a montagem pode demorar mais."
  fi
fi

passo "Baixando o código"
if ! command -v git >/dev/null; then
  dnf install -y -q git 2>/dev/null || yum install -y -q git 2>/dev/null || { apt-get update -qq && apt-get install -y -qq git; } ||
    falha "não consegui instalar o git."
fi
if [ -d "$PASTA/.git" ]; then
  git -C "$PASTA" fetch -q --depth 1 origin "$RAMO"
  git -C "$PASTA" reset -q --hard FETCH_HEAD
else
  git clone -q --depth 1 -b "$RAMO" "$REPO" "$PASTA"
fi
cd "$PASTA/lojas"
echo "Código em $PASTA (versão $(git rev-parse --short HEAD))."

passo "Configuração (.env)"
if [ -f .env ]; then
  echo "Já existe; mantenho o que está lá."
else
  ADMIN_EMAIL=${ADMIN_EMAIL:-}
  until [[ "$ADMIN_EMAIL" == *@*.* ]]; do
    read -rp "E-mail para entrar no painel das lojas: " ADMIN_EMAIL </dev/tty
  done
  umask 077
  cat >.env <<EOF
# Gerado por scripts/instalar-vps.sh em $(date +%F)
DB_SENHA=$(gerar 32)
APP_URL=https://$H_PAINEL
LOJA_DOMINIOS=$H_BG=bg-imports,$H_INF=infinite
ADMIN_EMAIL=$ADMIN_EMAIL
KIRA_API_TOKEN=$(gerar 40)
UPLOAD_DIR=/app/uploads
# ligação com o Caddy da VPS (docker-compose.vps.yml)
REDE_PROXY=$REDE
COMPOSE_FILE=docker-compose.yml:docker-compose.vps.yml
EOF
  umask 022
  echo "Criado."
fi
# a senha do primeiro acesso vai só para a criação do usuário; não fica gravada no servidor
if [ ! -f .painel-criado ]; then
  ADMIN_SENHA=${ADMIN_SENHA:-}
  until [ "${#ADMIN_SENHA}" -ge 10 ]; do
    read -rsp "Crie a senha do painel (pelo menos 10 caracteres; não aparece enquanto digita): " ADMIN_SENHA </dev/tty
    echo
    [ "${#ADMIN_SENHA}" -ge 10 ] || { aviso "Curta demais."; continue; }
    read -rsp "Repita a senha: " CONFIRMA </dev/tty
    echo
    [ "$ADMIN_SENHA" = "$CONFIRMA" ] || { aviso "As senhas não batem."; ADMIN_SENHA=""; }
  done
  export ADMIN_SENHA
fi
grep -q '^REDE_PROXY=' .env || printf 'REDE_PROXY=%s\nCOMPOSE_FILE=docker-compose.yml:docker-compose.vps.yml\n' "$REDE" >>.env

if command -v ss >/dev/null && ! docker compose ps --status running --services 2>/dev/null | grep -qx app &&
  ss -ltn | grep -q '127.0.0.1:3000 \|0.0.0.0:3000 \|\*:3000 '; then
  falha "a porta 3000 da VPS já está em uso por outro programa."
fi

passo "Montando as lojas (de 5 a 15 minutos; a Kira pode ficar mais lenta nesse tempo)"
# uma montagem por vez, para caber na memória
docker compose build app
docker compose build migrar
docker compose up -d --remove-orphans

echo -n "Esperando as lojas responderem"
for _ in $(seq 1 60); do
  if curl -fs -o /dev/null --max-time 5 http://127.0.0.1:3000/loja/bg-imports; then echo " ok"; break; fi
  echo -n "."
  sleep 3
done
curl -fsS -o /dev/null --max-time 5 http://127.0.0.1:3000/loja/bg-imports ||
  falha "as lojas não responderam. Veja o motivo com: cd $PASTA/lojas && docker compose logs --tail 50 app migrar"

touch .painel-criado

passo "Publicando no Caddy"
if grep -q "^$MARCA" "$CADDYFILE"; then
  echo "O Caddy já está configurado para as lojas."
else
  cp -p "$CADDYFILE" "$CADDYFILE.antes-das-lojas"
  {
    printf '\n%s (bloco das lojas; criado pelo instalar-vps.sh)\n' "$MARCA"
    printf '%s, %s, %s {\n' "$H_BG" "$H_INF" "$H_PAINEL"
    [ -n "${CADDY_TLS_INTERNO:-}" ] && printf '\ttls internal\n'
    printf '\tencode zstd gzip\n\treverse_proxy lojas:3000\n}\n'
  } >>"$CADDYFILE"
  if ! VALIDACAO=$(docker exec "$CADDY" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile 2>&1); then
    # escreve por cima (mesmo arquivo) para não quebrar o arquivo montado no container
    cat "$CADDYFILE.antes-das-lojas" >"$CADDYFILE"
    falha "o Caddy não aceitou o bloco novo; voltei o Caddyfile como estava. Motivo: $(tail -1 <<<"$VALIDACAO")"
  fi
  docker exec "$CADDY" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 || docker restart "$CADDY" >/dev/null
  echo "Bloco das lojas acrescentado (cópia do original em $CADDYFILE.antes-das-lojas)."
fi

echo -n "Esperando o certificado HTTPS"
OK=""
for _ in $(seq 1 30); do
  # testa direto no Caddy desta VPS, sem depender do DNS daqui
  if curl -fs -o /dev/null --max-time 10 ${CADDY_TLS_INTERNO:+-k} --resolve "$H_BG:443:127.0.0.1" "https://$H_BG/"; then OK=1; echo " ok"; break; fi
  echo -n "."
  sleep 4
done
[ -n "$OK" ] || aviso " ainda não. Pode levar alguns minutos; se continuar, veja: docker logs --tail 30 $CADDY"

cat <<EOF

$(printf '\033[32m')Pronto! As lojas estão no ar.$(printf '\033[0m')

  BG Imports:          https://$H_BG
  Infinite Semijoias:  https://$H_INF
  Painel de gestão:    https://$H_PAINEL/admin

Para atualizar depois, rode este mesmo instalador de novo.
EOF
