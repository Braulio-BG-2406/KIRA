#!/usr/bin/env bash
# Troca a senha de quem entra no painel das lojas (senha esquecida) ou cria um acesso
# novo para outra pessoa. Roda na VPS da Kira, como root.
#
#   bash vps-senha-painel.sh
#
# Direto do GitHub:
#   curl -fsSL https://raw.githubusercontent.com/Braulio-BG-2406/KIRA/refs/heads/claude/trusting-davinci-9g9zzb/lojas/scripts/vps-senha-painel.sh -o vps-senha-painel.sh && bash vps-senha-painel.sh
set -euo pipefail

PASTA=${PASTA:-/opt/kira-lojas/lojas}

aviso() { printf '\033[33m%s\033[0m\n' "$*"; }
falha() { printf '\n\033[31mErro: %s\033[0m\n' "$*" >&2; exit 1; }
sql() { docker compose exec -T db psql -U lojas -v ON_ERROR_STOP=1 -qtA "$@"; }

[ "$(id -u)" = 0 ] || falha "rode como root."
cd "$PASTA" 2>/dev/null && [ -f .env ] || falha "não achei as lojas em $PASTA."

echo "Quem entra no painel hoje:"
sql -c "select '  ' || email from usuarios order by id"

minusculo() { printf '%s' "$1" | tr 'A-Z' 'a-z' | tr -d '[:space:]'; }
EMAIL=$(minusculo "${EMAIL:-}")
until [[ "$EMAIL" =~ ^[^\'\"[:space:]\\]+@[^\'\"[:space:]\\]+\.[^\'\"[:space:]\\]+$ ]]; do
  read -rp "E-mail (de quem esqueceu a senha ou de quem vai ganhar acesso): " EMAIL </dev/tty
  EMAIL=$(minusculo "$EMAIL")
done
EXISTE=$(sql -c "select count(*) from usuarios where lower(email) = '$EMAIL'")
[ "$EXISTE" = 1 ] && echo "Vou trocar a senha de $EMAIL." || echo "$EMAIL ainda não entra no painel: vou criar o acesso."

SENHA=${SENHA:-}
until [ "${#SENHA}" -ge 10 ]; do
  read -rsp "Nova senha (pelo menos 10 caracteres; não aparece enquanto digita): " SENHA </dev/tty
  echo
  [ "${#SENHA}" -ge 10 ] || { aviso "Curta demais."; continue; }
  read -rsp "Repita a senha: " CONFIRMA </dev/tty
  echo
  [ "$SENHA" = "$CONFIRMA" ] || { aviso "As senhas não batem."; SENHA=""; }
done

# o hash é feito com o mesmo código do painel, dentro da imagem das lojas
HASH=$(docker compose run --rm --no-deps -T -e S="$SENHA" migrar npx tsx -e \
  'import("./src/lib/auth-hash.ts").then(async (m) => console.log(await (m.default ?? m).gerarHashSenha(process.env.S)))' 2>/dev/null | tail -1)
[[ "$HASH" =~ ^scrypt\$[0-9a-f]+\$[0-9a-f]+$ ]] || falha "não consegui gerar a senha nova. Veja se as lojas estão no ar: docker compose ps"

if [ "$EXISTE" = 1 ]; then
  # troca a senha e encerra as sessões abertas com a senha antiga
  sql -c "update usuarios set senha_hash = '$HASH' where lower(email) = '$EMAIL'" \
    -c "delete from sessoes where usuario_id in (select id from usuarios where lower(email) = '$EMAIL')"
  printf '\n\033[32mSenha trocada.\033[0m Entre de novo no painel com %s.\n' "$EMAIL"
else
  sql -c "insert into usuarios (nome, email, senha_hash) values ('${EMAIL%%@*}', '$EMAIL', '$HASH')"
  printf '\n\033[32mAcesso criado.\033[0m %s já pode entrar no painel.\n' "$EMAIL"
fi
