---
name: publicar-lojas-vps
description: Coloca no ar, atualiza e conserta as lojas da plataforma de vendas + ERP (pasta lojas/ do repositório Braulio-BG-2406/KIRA - BG Imports, Infinite Semijoias e outras) na VPS da Kira (Locaweb, Rocky Linux, n8n + Caddy em Docker). Como o Claude não alcança a VPS, entrega ao usuário um comando por vez para colar no PowerShell (SSH) e lê os prints que ele manda. Cobre verificação da VPS, instalação e atualização em um comando, HTTPS no Caddy sem derrubar o n8n, domínio próprio, senha do painel, backup do banco, fail2ban e os erros já vistos. Use sempre que o usuário falar em publicar, colocar no ar, subir, instalar, atualizar ou consertar o site, as lojas ou o painel; mandar print do PowerShell, da VPS ou da Locaweb; falar de domínio, HTTPS, Caddy, VPS, senha do painel ou backup; ou quando uma mudança no código das lojas precisar chegar ao site no ar.
---

# Publicar as lojas na VPS da Kira

O usuário (dono da BG Imports e da Infinite Semijoias) não é programador. As lojas
rodam na mesma VPS da Kira, o assistente dele feito no n8n. **O Claude não consegue
entrar na VPS**: a rede do ambiente bloqueia o endereço dela e os endereços das lojas,
e o n8n não tem SSH nem o nó "Execute Command". Por isso o trabalho é sempre:

1. preparar um comando seguro, testado e pronto para colar;
2. dizer em uma frase o que ele faz e o que deve aparecer no fim;
3. ler o print que o usuário manda e decidir o próximo passo.

Os scripts deste fluxo estão no repositório, em `lojas/scripts/`, e foram testados
numa VPS simulada (Caddy + n8n falso em Docker). Prefira chamá-los a escrever
comandos novos na hora; se precisar de um comando novo, teste antes do mesmo jeito
(ver "Testar antes de mandar").

## O que está instalado

Confira com a verificação (fluxo 1) antes de agir: pode ter mudado.

| Item | Valor |
|---|---|
| VPS | `vps71390.publiccloud.com.br`, IP `177.153.67.118`, Rocky Linux 10, 1,7 GB de RAM + 3 GB de swap, 50 GB livres |
| Kira | `/opt/kira` (docker compose): `kira-n8n-1`, `kira-caddy-1` (portas 80/443), `kira-kira-video-1`; rede `kira_default`; Caddyfile em `/opt/kira/Caddyfile` |
| Lojas | `/opt/kira-lojas` (clone raso do repositório); app em `/opt/kira-lojas/lojas`: `lojas-db-1` (PostgreSQL 16), `lojas-migrar-1` (migrações + seed a cada subida), `lojas-app-1` (Next.js em `127.0.0.1:3000`, apelido `lojas` na rede `kira_default`) |
| Endereços | `https://bgimports.177-153-67-118.sslip.io`, `https://infinite.177-153-67-118.sslip.io`, painel em `https://painel.177-153-67-118.sslip.io/admin` |
| Configuração | `/opt/kira-lojas/lojas/.env`: DB_SENHA, APP_URL, LOJA_DOMINIOS, ADMIN_EMAIL, KIRA_API_TOKEN, REDE_PROXY, COMPOSE_FILE. A senha do painel não fica gravada. |
| Caddy | bloco das lojas no fim do Caddyfile, começando em `# lojas-kira`; cópias `.antes-das-lojas` e `.antes-do-dominio` ao lado |
| Segurança | fail2ban no sshd: 5 erros em 10 min = 1 h de bloqueio (`/etc/fail2ban/jail.d/sshd-kira.local`, ação nftables porque o firewalld está desligado) |
| Código no ar | branch `claude/trusting-davinci-9g9zzb` (variável `RAMO` do instalador). Se for incorporada à main, use `RAMO=main`. |

Nunca peça print do `.env` inteiro, de senhas ou do token da Kira.

## Como falar com o usuário

- Ele entra pelo PowerShell do Windows: `ssh root@vps71390.publiccloud.com.br`. A senha
  não aparece enquanto ele digita. O terminal web do painel da Locaweb **não aceita
  colar**: use só como último recurso (por exemplo, se o fail2ban bloquear o IP dele).
- Um comando por vez, numa linha, em bloco de código. Colar = botão direito.
- Em diagnóstico, só comandos que leem. Diga quando um comando muda algo.
- Avise quando a Kira vai ficar lenta: montar as lojas leva de 5 a 15 minutos e usa
  quase toda a memória.
- Se a conexão cair (`client_loop: send disconnect`), ele reconecta e roda de novo:
  todos os scripts podem ser repetidos sem estragar nada.
- Explique termos em uma frase (swap = memória de reserva no disco; DNS = o "endereço"
  que liga o domínio ao IP da VPS).
- Não prometa acompanhar sozinho. Dá para marcar uma volta com `send_later`, mas daqui
  só se enxerga o que o conector do n8n alcança (e ele às vezes pede login de novo: o
  usuário reconecta nas configurações de conectores do claude.ai).

## Fluxos

### 1. Verificar a VPS (só lê)

```bash
echo "== memória"; free -h; echo "== disco"; df -h /; echo "== containers"; docker ps -a --format '{{.Names}} | {{.Status}}'; echo "== portas 80 e 443"; ss -ltnp | grep -E ':(80|443) '; echo "== IP"; curl -s https://api.ipify.org; echo
```

Motivo de um erro das lojas:

```bash
cd /opt/kira-lojas/lojas && docker compose logs --no-color --tail 30 migrar app; docker ps -a --format '{{.Names}} | {{.Status}}'; dmesg -T 2>/dev/null | grep -i "killed process" | tail -3
```

### 2. Instalar ou atualizar

```bash
curl -fsSL https://raw.githubusercontent.com/Braulio-BG-2406/KIRA/refs/heads/claude/trusting-davinci-9g9zzb/lojas/scripts/instalar-vps.sh -o instalar-lojas.sh && bash instalar-lojas.sh
```

Da segunda vez em diante o arquivo já está em `/root`: `cd ~ && bash instalar-lojas.sh`.

O instalador: acha o Caddy que atende a porta 443 e a rede dele; cria 2 GB de swap se
faltar; baixa o código em `/opt/kira-lojas`; cria o `.env` com senhas aleatórias (só na
primeira vez, pedindo o e-mail do painel); pede a senha do painel enquanto o painel não
existir; monta as imagens uma de cada vez; sobe banco, migrações e lojas; acrescenta o
bloco das lojas no Caddyfile (valida e, se o Caddy recusar, volta o original); espera o
HTTPS. No fim aparece `Pronto!` com os três endereços.

**Repetir sem remontar.** Se só o passo do banco falhou e o código não mudou, fixe a
versão que já está montada, para não montar tudo de novo:

```bash
cd ~ && RAMO=$(git -C /opt/kira-lojas rev-parse HEAD) bash instalar-lojas.sh
```

**O que obriga a remontar:** qualquer mudança em `lojas/` que entre na imagem (código,
`package.json`, `scripts/seed.ts`, `scripts/migrate.ts`...). Mudanças só em
`docker-compose*.yml`, `README.md`, `dados/`, `scripts/instalar-vps.sh` e
`scripts/vps-*.sh` não remontam (estão no `.dockerignore`).

### 3. Levar uma mudança de código ao ar

1. No repositório: `npx tsc --noEmit`, `npx vitest run`, `npm run build` e, se mexeu em
   telas, `npx playwright test`. Commit e push na branch do `RAMO`.
2. O usuário roda o instalador (fluxo 2). As migrações (`lojas/drizzle/`) rodam sozinhas.
3. Loja nova cadastrada em `scripts/seed.ts` é criada nessa subida. O seed **não muda**
   loja que já existe: nome, tema e cores de loja existente mudam no painel
   (Configurações). Depois, ligue um endereço para ela (fluxo 4).

### 4. Domínio próprio (ou endereço para uma loja nova)

Antes, o usuário compra o domínio (registro.br, cerca de R$ 40 por ano) e cria registros
A para `dominio` e `www.dominio` apontando para `177.153.67.118`. Depois:

```bash
curl -fsSL https://raw.githubusercontent.com/Braulio-BG-2406/KIRA/refs/heads/claude/trusting-davinci-9g9zzb/lojas/scripts/vps-dominio.sh | bash -s -- bgimports.com.br bg-imports
```

- O segundo valor é o código (slug) da loja; se errar, o script lista os que existem.
- Para o painel: `... | bash -s -- painel.bgimports.com.br painel` (troca o APP_URL).
- Loja nova sem domínio ainda: use um nome do sslip.io, que já aponta para a VPS:
  `... | bash -s -- novaloja.177-153-67-118.sslip.io nova-loja`.
- O script confere o DNS e para com explicação se ainda não propagou (minutos a algumas
  horas). `FORCAR=1` antes do `bash` pula essa conferência; use só se tiver certeza.
- Ele acrescenta os nomes no bloco das lojas do Caddy (validado, com cópia), atualiza o
  `.env`, reinicia só o container das lojas e espera o HTTPS. Os endereços antigos
  continuam valendo.
- Depois: trocar o link na bio do Instagram, o endereço do feed no Google Merchant
  (`https://dominio/feed.xml`) e, se usar Mercado Pago, conferir as notificações.

### 5. Senha do painel esquecida ou acesso para outra pessoa

```bash
curl -fsSL https://raw.githubusercontent.com/Braulio-BG-2406/KIRA/refs/heads/claude/trusting-davinci-9g9zzb/lojas/scripts/vps-senha-painel.sh -o vps-senha-painel.sh && bash vps-senha-painel.sh
```

Lista quem entra hoje, pede o e-mail e a senha nova (duas vezes). E-mail que já existe
tem a senha trocada e as sessões antigas encerradas; e-mail novo ganha acesso.
"Muitas tentativas. Espere 15 minutos." no login: esperar, ou
`cd /opt/kira-lojas/lojas && docker compose restart app`.

### 6. Backup do banco

```bash
mkdir -p /root/backups && cd /opt/kira-lojas/lojas && docker compose exec -T db pg_dump -U lojas lojas | gzip > /root/backups/lojas-$(date +%F).sql.gz && ls -lh /root/backups | tail -3
```

As fotos ficam no volume `lojas_fotos`. Restaurar um backup apaga os dados atuais: só
com pedido claro do usuário. O workflow "Kira — Backup semanal" do n8n pode passar a
incluir esse arquivo (ver skill equipe-de-agentes).

### 7. Segurança do SSH

`fail2ban-client status sshd` mostra quem está bloqueado. Se o próprio usuário for
bloqueado (errou a senha 5 vezes), ele espera 1 hora ou entra pelo terminal web da
Locaweb e roda `fail2ban-client set sshd unbanip <IP dele>`.

## Problemas já vistos

| O que aparece | Causa | O que fazer |
|---|---|---|
| `service "migrar" didn't complete successfully: exit 1` e, nos logs, `getaddrinfo EAI_AGAIN db` | VPS ainda ocupada logo depois de montar; o banco demorou a responder | Desde o commit 4ab4e1d o migrar tenta 6 vezes (a VPS ganha isso na próxima atualização normal). Se acontecer, rodar de novo com a versão fixa (fluxo 2) |
| Instalação parou em `Montando as lojas` e o n8n ficou lento ou sem responder | Montagem usando toda a memória | Esperar. É temporário; o swap evita que algo seja derrubado |
| `o Caddy não aceitou o bloco novo; voltei o Caddyfile como estava. Motivo: ...` | Algum nome já existe em outro bloco do Caddyfile, ou erro de digitação | Ler o motivo; nada mudou no n8n |
| HTTPS fica em `ainda não` | DNS ainda não propagou, ou limite de emissão de certificado | `docker logs --tail 30 kira-caddy-1`; esperar e conferir o DNS |
| `a porta 3000 da VPS já está em uso` | Outro programa na porta | `ss -ltnp \| grep :3000` para ver qual |
| Conector do n8n pede login de novo | O acesso do Claude ao n8n expirou | O usuário reconecta nas configurações de conectores do claude.ai |
| `client_loop: send disconnect: Connection reset` | Conexão SSH caiu | Reconectar e repetir o último comando |

## Testar antes de mandar

O ambiente do Claude tem Docker. Para um comando novo que mexe na VPS, monte uma VPS
simulada: um `docker compose -p kira` com `caddy:2` (portas 80/443, Caddyfile montado
como arquivo, bloco do n8n com `tls internal`) e um n8n falso
(`node -e "require('http').createServer((q, r) => r.end('n8n ok')).listen(5678)"`).
Copie o repositório para uma pasta de teste com commit local e rode o instalador com
`REPO=<pasta> RAMO=<branch> PASTA=<pasta de teste> IP=127.0.0.1 CADDY_TLS_INTERNO=1
ADMIN_EMAIL=... ADMIN_SENHA=...`, sem o proxy do ambiente
(`env HTTPS_PROXY= HTTP_PROXY= NO_PROXY='*'`). Para o `npm ci` dentro do build, a cópia
de teste precisa de `network: host`, dos build args `HTTPS_PROXY`/`HTTP_PROXY` com a
porta atual do proxy (`echo $HTTPS_PROXY`) e de `NODE_EXTRA_CA_CERTS` apontando para
`/root/.ccr/ca-bundle.crt` copiado no contexto. Confira com
`curl -sk --noproxy '*' --resolve <nome>:443:127.0.0.1 https://<nome>/`. Teste também
o caminho de erro (Caddy recusando, banco sem responder). No fim, `docker compose down -v`
e `swapoff /swapfile-lojas`.

## Evoluir esta skill

Erro novo resolvido = linha nova em "Problemas já vistos", com a causa. A fonte desta
skill está em `skills/publicar-lojas-vps/` no repositório; depois de mudar, gere o
pacote de novo e mande para o usuário salvar (ver skill equipe-de-agentes).
