#!/usr/bin/env bash
# Instala o n8n da Kira numa VPS com Rocky Linux / RHEL (9 ou 10), usando Docker e Caddy (HTTPS automático e
# gratuito, com Let's Encrypt). Rode como root:
#   bash instalar.sh <endereço da VPS>        ex.: bash instalar.sh kira.exemplo.com.br
# Pode rodar de novo sem medo: a chave de criptografia e os dados do n8n são mantidos.
set -euo pipefail

DOMINIO="${1:-}"
PASTA=/opt/kira

if [ -z "$DOMINIO" ]; then
  echo "Uso: bash instalar.sh <endereço da VPS>   (ex.: bash instalar.sh kira.exemplo.com.br)"
  exit 1
fi
if [ "$(id -u)" != 0 ]; then
  echo "Rode como root."
  exit 1
fi

echo "==> 1/5 Docker"
if ! command -v docker >/dev/null 2>&1; then
  VERSAO=$(. /etc/os-release && echo "${VERSION_ID%%.*}")
  cat > /etc/yum.repos.d/docker-ce.repo <<EOF
[docker-ce-stable]
name=Docker CE Stable
baseurl=https://download.docker.com/linux/rhel/${VERSAO}/\$basearch/stable
enabled=1
gpgcheck=1
gpgkey=https://download.docker.com/linux/rhel/gpg
EOF
  dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

echo "==> 2/5 Firewall (portas 80 e 443)"
if systemctl is-active --quiet firewalld; then
  firewall-cmd --permanent --add-service=http --add-service=https
  firewall-cmd --permanent --add-port=443/udp
  firewall-cmd --reload
else
  echo "firewalld desligado: nada a fazer"
fi

echo "==> 3/5 Configuração em $PASTA"
mkdir -p "$PASTA"
cd "$PASTA"
if [ ! -f .env ]; then
  # A chave que protege as credenciais do n8n é criada aqui e nunca sai da VPS.
  CHAVE=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
  if [ "${#CHAVE}" -ne 64 ]; then
    echo "Não consegui gerar a chave de criptografia."
    exit 1
  fi
  (umask 077 && printf 'DOMINIO=%s\nN8N_ENCRYPTION_KEY=%s\n' "$DOMINIO" "$CHAVE" > .env)
else
  sed -i "s/^DOMINIO=.*/DOMINIO=$DOMINIO/" .env
fi

cat > docker-compose.yml <<'EOF'
services:
  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    restart: unless-stopped
    environment:
      - N8N_HOST=${DOMINIO}
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://${DOMINIO}/
      - N8N_PROXY_HOPS=1
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
      - GENERIC_TIMEZONE=America/Sao_Paulo
      - TZ=America/Sao_Paulo
      - N8N_DEFAULT_BINARY_DATA_MODE=filesystem
      - EXECUTIONS_DATA_PRUNE=true
      - EXECUTIONS_DATA_MAX_AGE=336
      - N8N_DIAGNOSTICS_ENABLED=false
    volumes:
      - n8n_data:/home/node/.n8n

  caddy:
    image: caddy:2
    restart: unless-stopped
    depends_on:
      - n8n
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    environment:
      - DOMINIO=${DOMINIO}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro,Z
      - caddy_data:/data
      - caddy_config:/config

volumes:
  n8n_data:
  caddy_data:
  caddy_config:
EOF

cat > Caddyfile <<'EOF'
{$DOMINIO} {
	encode gzip
	reverse_proxy n8n:5678
}
EOF

echo "==> 4/5 Baixando e subindo o n8n e o Caddy (pode levar alguns minutos)"
docker compose pull
docker compose up -d

echo "==> 5/5 Esperando o certificado HTTPS e o n8n ficarem prontos"
for _ in $(seq 1 40); do
  if curl -fsS -o /dev/null --max-time 5 "https://$DOMINIO/healthz"; then
    echo
    echo "PRONTO! Abra agora no navegador: https://$DOMINIO"
    echo "Crie já a conta de dono do n8n (e-mail e senha forte)."
    echo "A chave que protege as credenciais fica em $PASTA/.env: guarde uma cópia num lugar seguro (nunca em chats)."
    exit 0
  fi
  sleep 6
done
echo
echo "O n8n subiu, mas o HTTPS ainda não respondeu. Últimas linhas do Caddy:"
docker compose logs --tail=25 caddy
exit 1
