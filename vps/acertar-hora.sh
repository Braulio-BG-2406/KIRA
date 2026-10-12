#!/usr/bin/env bash
# Acerta o relógio da VPS pela hora de um site HTTPS e repete a cada hora. Serve para VPS que bloqueiam o NTP
# (porta 123/UDP): no "chronyc sources", todos os servidores ficam com Reach 0 e o relógio vai atrasando.
# Com o relógio atrasado, os agendamentos do n8n saem fora de hora e alguns logins (Microsoft, Google) podem falhar.
# Rode como root:   bash acertar-hora.sh
# Pode rodar de novo sem medo. Se o NTP voltar a funcionar, o chrony continua cuidando do relógio normalmente.
set -euo pipefail

if [ "$(id -u)" != 0 ]; then
  echo "Rode como root."
  exit 1
fi

echo "==> 1/3 Instalando o acerto da hora"
cat > /usr/local/bin/kira-acertar-hora <<'EOF'
#!/bin/sh
# Pega a hora do cabeçalho "Date" de sites HTTPS (precisão de cerca de 1 segundo) e acerta o relógio.
for SITE in https://www.google.com https://www.cloudflare.com https://www.microsoft.com; do
  D=$(curl -fsSI --max-time 10 "$SITE" 2>/dev/null | grep -i '^date:' | head -n1 | cut -d' ' -f2- | tr -d '\r')
  if [ -n "$D" ] && date -u -s "$D" >/dev/null 2>&1; then
    hwclock -w >/dev/null 2>&1 || true
    exit 0
  fi
done
echo "Não consegui pegar a hora de nenhum site." >&2
exit 1
EOF
chmod 755 /usr/local/bin/kira-acertar-hora

cat > /etc/systemd/system/kira-acertar-hora.service <<'EOF'
[Unit]
Description=Kira: acerta o relógio pela hora de um site HTTPS
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/kira-acertar-hora
EOF

cat > /etc/systemd/system/kira-acertar-hora.timer <<'EOF'
[Unit]
Description=Kira: acerta o relógio a cada hora

[Timer]
OnBootSec=2min
OnUnitActiveSec=1h

[Install]
WantedBy=timers.target
EOF

echo "==> 2/3 Ligando a conferência de hora em hora"
systemctl daemon-reload
systemctl enable --now kira-acertar-hora.timer >/dev/null

echo "==> 3/3 Acertando agora"
ANTES=$(date -u +%s)
/usr/local/bin/kira-acertar-hora
DEPOIS=$(date -u +%s)
echo
echo "PRONTO! O relógio andou $((DEPOIS - ANTES)) segundo(s)."
echo "Hora da VPS agora: $(date '+%d/%m/%Y %H:%M:%S')"
