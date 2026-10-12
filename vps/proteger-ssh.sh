#!/usr/bin/env bash
# Protege o acesso SSH da VPS: instala o fail2ban, que bloqueia por 1 hora quem errar a senha 5 vezes em 10 minutos
# (robôs da internet tentam milhares de senhas no usuário root). Quem bloqueia é o firewall (firewalld, ou nftables
# se o firewalld estiver desligado). O seu jeito de entrar não muda, e o endereço de onde você está agora fica na
# lista de liberados, para você não se bloquear sem querer.
# Rode como root, de dentro do SSH:   bash proteger-ssh.sh
# Pode rodar de novo sem medo.
set -euo pipefail

if [ "$(id -u)" != 0 ]; then
  echo "Rode como root."
  exit 1
fi

echo "==> 1/3 Instalando o fail2ban"
# O fail2ban vem do EPEL (repositório extra do Rocky/RHEL). O "systemd" é para ler as tentativas de login direto do
# journal, porque o Rocky novo não grava mais /var/log/secure.
dnf -y install epel-release >/dev/null 2>&1 ||
  dnf -y install "https://dl.fedoraproject.org/pub/epel/epel-release-latest-$(. /etc/os-release && echo "${VERSION_ID%%.*}").noarch.rpm" >/dev/null
dnf -y install fail2ban fail2ban-systemd >/dev/null 2>&1 || dnf -y install fail2ban python3-systemd >/dev/null

echo "==> 2/3 Configurando"
MEU_IP="${SSH_CLIENT:-}"
MEU_IP="${MEU_IP%% *}"
if systemctl is-active --quiet firewalld; then
  BLOQUEIO=firewallcmd-rich-rules
else
  BLOQUEIO=nftables-multiport
fi
cat > /etc/fail2ban/jail.d/kira-ssh.local <<EOF
# Criado pelo proteger-ssh.sh da Kira.
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
backend = systemd
banaction = $BLOQUEIO
ignoreip = 127.0.0.1/8 ::1 ${MEU_IP}

[sshd]
enabled = true
EOF

echo "==> 3/3 Ligando"
systemctl enable fail2ban >/dev/null 2>&1
systemctl restart fail2ban
sleep 3
echo
fail2ban-client status sshd
echo
echo "PRONTO! Quem errar a senha do SSH 5 vezes em 10 minutos fica bloqueado por 1 hora."
if [ -n "$MEU_IP" ]; then
  echo "O endereço de onde você entrou agora está liberado."
fi
