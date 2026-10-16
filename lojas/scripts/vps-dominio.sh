#!/usr/bin/env bash
# Liga um domínio próprio a uma loja (ou ao painel) na VPS da Kira, sem mexer no n8n.
#
# Antes: no site onde o domínio foi comprado (ex.: registro.br), crie registros A
# apontando para o IP da VPS: um para o domínio e outro para o www.
#
# Uso, como root:
#   bash vps-dominio.sh bgimports.com.br bg-imports        # loja (também liga o www)
#   bash vps-dominio.sh painel.bgimports.com.br painel     # endereço do painel
#
# Direto do GitHub:
#   curl -fsSL https://raw.githubusercontent.com/Braulio-BG-2406/KIRA/refs/heads/claude/trusting-davinci-9g9zzb/lojas/scripts/vps-dominio.sh | bash -s -- bgimports.com.br bg-imports
#
# Os endereços antigos (sslip.io) continuam funcionando.
set -euo pipefail

PASTA=${PASTA:-/opt/kira-lojas/lojas}
MARCA="# lojas-kira"

aviso() { printf '\033[33m%s\033[0m\n' "$*"; }
falha() { printf '\n\033[31mErro: %s\033[0m\n' "$*" >&2; exit 1; }

DOMINIO=$(printf '%s' "${1:-}" | tr 'A-Z' 'a-z' | sed -E 's#^https?://##; s#/.*$##; s#^www\.##')
DESTINO=$(printf '%s' "${2:-}" | tr 'A-Z' 'a-z')
[[ "$DOMINIO" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]] && [ -n "$DESTINO" ] ||
  falha "use assim: bash vps-dominio.sh bgimports.com.br bg-imports (ou: painel.seudominio.com.br painel)"
[ "$(id -u)" = 0 ] || falha "rode como root."
cd "$PASTA" 2>/dev/null && [ -f .env ] || falha "não achei as lojas em $PASTA. Rode o instalador primeiro."

if [ "$DESTINO" = painel ]; then
  NOMES=("$DOMINIO")
else
  LOJAS=$(docker compose exec -T db psql -U lojas -tAc "select string_agg(slug, ', ' order by id) from lojas")
  [[ "$DESTINO" =~ ^[a-z0-9-]+$ ]] && [[ ", $LOJAS, " == *", $DESTINO, "* ]] ||
    falha "não existe loja '$DESTINO'. Lojas: $LOJAS (ou use 'painel')."
  NOMES=("$DOMINIO" "www.$DOMINIO")
fi

echo "== Conferindo o DNS"
IP=${IP:-$(curl -fsS --max-time 15 https://api.ipify.org || true)}
for n in "${NOMES[@]}"; do
  aponta=$(getent ahostsv4 "$n" 2>/dev/null | awk 'NR==1 {print $1}' || true)
  if [ "$aponta" = "$IP" ]; then
    echo "$n -> $IP ok"
  elif [ -n "${FORCAR:-}" ]; then
    aviso "$n aponta para '${aponta:-nada}', não para $IP. Sigo assim mesmo (FORCAR=1)."
  else
    falha "$n aponta para '${aponta:-nada}', e não para o IP da VPS ($IP). Crie o registro A no site do domínio e espere propagar (de minutos a algumas horas)."
  fi
done

echo "== Caddy"
CADDY=$(docker ps --filter publish=443 --format '{{.Names}} {{.Image}}' | awk '$2 ~ /(^|\/)caddy(:|$)/ {print $1; exit}')
[ -n "$CADDY" ] || falha "não achei o container do Caddy."
CF=$(docker inspect "$CADDY" --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}')
[ -n "$CF" ] || CF="$(docker inspect "$CADDY" --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy"}}{{.Source}}{{end}}{{end}}')/Caddyfile"
[ -f "$CF" ] || falha "não achei o Caddyfile."
L=$(grep -n "^$MARCA" "$CF" | head -1 | cut -d: -f1)
[ -n "$L" ] || falha "o Caddyfile não tem o bloco das lojas. Rode o instalador primeiro."
L=$((L + 1))
LINHA=$(sed -n "${L}p" "$CF")
[[ "$LINHA" == *"{" ]] || falha "a linha $L do Caddyfile não é a dos endereços das lojas: $LINHA"
NOVA="${LINHA%\{}"
NOVA="${NOVA%"${NOVA##*[![:space:]]}"}"
for n in "${NOMES[@]}"; do
  [[ ", $NOVA, " == *", $n, "* ]] || NOVA="$NOVA, $n"
done
NOVA="$NOVA {"
if [ "$NOVA" = "$LINHA" ]; then
  echo "O Caddy já atende esses endereços."
else
  cp -p "$CF" "$CF.antes-do-dominio"
  # escreve no mesmo arquivo (o container enxerga o arquivo montado, não uma cópia nova)
  TMP=$(mktemp)
  awk -v n="$L" -v linha="$NOVA" 'NR == n {print linha; next} {print}' "$CF" >"$TMP"
  cat "$TMP" >"$CF"
  rm -f "$TMP"
  if ! VALIDACAO=$(docker exec "$CADDY" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile 2>&1); then
    cat "$CF.antes-do-dominio" >"$CF"
    falha "o Caddy não aceitou; voltei o Caddyfile como estava. Motivo: $(tail -1 <<<"$VALIDACAO")"
  fi
  docker exec "$CADDY" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 || docker restart "$CADDY" >/dev/null
  echo "Endereços acrescentados (cópia do original em $CF.antes-do-dominio)."
fi

echo "== Lojas"
cp -p .env .env.antes-do-dominio
if [ "$DESTINO" = painel ]; then
  sed -i "s#^APP_URL=.*#APP_URL=https://$DOMINIO#" .env
else
  ATUAL=$(sed -n 's/^LOJA_DOMINIOS=//p' .env)
  for n in "${NOMES[@]}"; do
    [[ ",$ATUAL," == *",$n="* ]] || ATUAL="${ATUAL:+$ATUAL,}$n=$DESTINO"
  done
  if grep -q '^LOJA_DOMINIOS=' .env; then
    sed -i "s#^LOJA_DOMINIOS=.*#LOJA_DOMINIOS=$ATUAL#" .env
  else
    echo "LOJA_DOMINIOS=$ATUAL" >>.env
  fi
fi
docker compose up -d --no-deps --no-build app >/dev/null 2>&1 || falha "não consegui reiniciar as lojas. Veja: cd $PASTA && docker compose logs --tail 30 app"

echo -n "Esperando o certificado HTTPS de ${NOMES[0]}"
for _ in $(seq 1 30); do
  if curl -fs -o /dev/null --max-time 10 ${CADDY_TLS_INTERNO:+-k} --resolve "${NOMES[0]}:443:127.0.0.1" "https://${NOMES[0]}/"; then
    echo " ok"
    printf '\n\033[32mPronto!\033[0m https://%s' "${NOMES[0]}"
    [ "$DESTINO" = painel ] && printf '/admin'
    printf '\n'
    exit 0
  fi
  echo -n "."
  sleep 4
done
aviso " ainda não. Pode levar alguns minutos; se continuar, veja: docker logs --tail 30 $CADDY"
