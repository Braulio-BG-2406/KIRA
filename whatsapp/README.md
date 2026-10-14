# Kira no WhatsApp

A Kira continua no Telegram e passa a ter acesso ao seu WhatsApp pessoal:

- **Lê seus grupos e conversas** e guarda as mensagens por 15 dias no seu n8n (tabela `kira_whatsapp`).
- **Avisa no Telegram** quando alguém **marca você**, **responde uma mensagem sua** ou **escreve o seu nome** num grupo, já com uma **sugestão de resposta no seu jeito de escrever** (ela aprende com as mensagens que você mesmo manda).
- **Só envia com o seu OK**: toque em `/whats_N` no aviso, mande `/whats N seu texto` ou diga "manda" para a Kira.
- Você também pode pedir: "resume o grupo da família", "o que falaram de mim hoje?", "quais conversas estão esperando resposta?", "responde o João que eu chego às 19h".

**Custo: zero.** O WAHA Core é gratuito e roda na VPS que você já tem. A sugestão de resposta usa o mesmo Gemini da Kira, no modelo mais leve (`gemini-flash-lite`), e só quando alguém fala com você. As outras mensagens só são guardadas, sem passar por IA.

## Antes de começar: o risco

Para ler os **seus** grupos, a Kira entra no WhatsApp como um "aparelho conectado", igual ao WhatsApp Web, usando o **WAHA** (não oficial). A API oficial da Meta não dá acesso à sua conta pessoal nem aos seus grupos. O WhatsApp proíbe automação não oficial e **pode bloquear o número** se perceber uso de robô. O risco diminui porque a Kira:

- não manda nada sozinha (só com o seu OK);
- manda poucas mensagens, sempre respondendo conversas que já existem;
- nunca manda mensagens em massa nem para quem não está nas suas conversas.

Se quiser zerar o risco, use um número secundário em vez do principal.

**Privacidade:** as mensagens ficam só no seu servidor (n8n). Quando alguém fala com você num grupo, as últimas mensagens daquele grupo vão para o Gemini (Google) para ele sugerir a resposta.

## Instalação (uns 10 minutos)

### 1. Entre na VPS

A Kira roda na sua VPS da Locaweb (`vps71390.publiccloud.com.br`). Abra o terminal dela de um destes jeitos:

- **Painel da Locaweb:** Cloud / VPS > sua VPS > **Console** (ou "Acessar via navegador").
- **Pelo computador:** abra o Terminal (Mac/Linux) ou o PowerShell (Windows) e digite
  `ssh root@vps71390.publiccloud.com.br` (a senha de root fica no painel da Locaweb).

### 2. Rode o instalador

Cole estas duas linhas no terminal da VPS:

```bash
curl -fsSL https://raw.githubusercontent.com/Braulio-BG-2406/KIRA/claude/tender-heisenberg-0xlacs/whatsapp/instalar.sh -o instalar.sh
bash instalar.sh
```

O instalador ([`instalar.sh`](instalar.sh)):

1. acha o container do n8n e a rede Docker dele;
2. gera uma chave secreta e cria o WAHA em `/opt/kira-whatsapp`, na mesma rede do n8n, **sem porta aberta para a internet**;
3. confere se o n8n enxerga o WAHA;
4. cria no n8n a credencial **WAHA (Kira)** com a mesma chave.

Se ele não conseguir criar a credencial, mostra como criar à mão (n8n > Credentials > Header Auth, `Name: X-Api-Key`, `Value:` a chave do arquivo `/opt/kira-whatsapp/.env`).

### 3. Avise o Claude

Volte ao chat do Claude e diga **"instalei o WAHA"**. Ele liga a credencial nos dois workflows do WhatsApp e liga o recebimento das mensagens.

Sem o Claude: no n8n, abra **Kira — WhatsApp (ferramenta)** e **Kira — WhatsApp (receber)**, escolha a credencial **WAHA (Kira)** em cada nó HTTP (os que estão com aviso), salve e publique os dois.

### 4. Conecte o WhatsApp

No Telegram, mande **`/whatsapp`** para a Kira. Ela manda um **QR code**:

- No celular: **WhatsApp > Configurações (ou ⋮) > Aparelhos conectados > Conectar um aparelho** e aponte a câmera para o QR code. Ele vale por uns 20 segundos; se expirar, mande `/whatsapp` de novo.
- **Só tem o celular?** (não dá para escanear a própria tela) Mande **`/whatsapp 11999998888`** (seu número com DDD). A Kira manda um código de 8 letras: em *Conectar um aparelho*, toque em **"Conectar com número de telefone"** e digite o código.

Quando conectar, a Kira avisa: "✅ WhatsApp conectado".

## Comandos

| Comando | O que faz |
|---|---|
| `/whatsapp` | Conecta o WhatsApp ou mostra se está conectado |
| `/whatsapp 11999998888` | Conecta com código em vez do QR code |
| `/whats` | Lista as respostas esperando o seu OK |
| `/whats_12` | Envia a sugestão #12 (é só tocar no aviso) |
| `/whats 12 seu texto` | Envia o seu texto no lugar da sugestão #12 (respondendo a mesma mensagem) |

Também dá para falar normalmente: "muda a sugestão 12 para algo mais curto", "manda", "descarta a 12".

## Ajustes

No n8n, workflow **Kira — WhatsApp (receber)**, nó **Configuração do WhatsApp**:

| Campo | Para que serve |
|---|---|
| `apelidos` | Nomes que contam como "chamar você" (padrão: `Bráulio, Braulio`) |
| `grupos_silenciados` | Grupos que nunca geram aviso: partes do nome, separadas por vírgula (ex.: `condomínio, promoções`) |
| `avisar_privado` | `true` para avisar também nas conversas privadas (padrão: só grupos) |
| `estilo` | Uma frase sobre o seu jeito de escrever, para ajudar nas sugestões |
| `dias_guardados` | Quantos dias guardar as mensagens (padrão: 15) |

## Manutenção

- **Ver se está tudo bem:** mande `/whatsapp` para a Kira. Se o WhatsApp cair ou for desconectado, ela avisa sozinha no Telegram.
- **Ver o log do WAHA:** na VPS, `docker logs --tail 50 kira-whatsapp`.
- **Atualizar o WAHA** (se um dia o WhatsApp mudar algo e ele parar de conectar): troque a versão em `IMAGEM=` no `instalar.sh` pela mais nova de `gows-` em [hub.docker.com/r/devlikeapro/waha/tags](https://hub.docker.com/r/devlikeapro/waha/tags) e rode o instalador de novo. A conexão continua (fica em `/opt/kira-whatsapp/sessions`).
- **Desligar:** no celular, *Aparelhos conectados* > remova o aparelho da Kira. Para tirar o WAHA da VPS: `cd /opt/kira-whatsapp && docker compose down`.

## Como funciona (para o Claude e para quem mexer no n8n)

```
WhatsApp ──(aparelho conectado)── WAHA (container kira-whatsapp, rede do n8n, sem porta pública)
   │ webhook message.any / session.status
   ▼
Kira — WhatsApp (receber)  ──►  tabela kira_whatsapp (15 dias)
   │ alguém falou com você num grupo?
   ├─► Gemini lite sugere a resposta no seu estilo ──► tabela kira_whatsapp_rascunhos (#N)
   └─► aviso no Telegram com /whats_N

Kira 2.0 (Telegram) ── ferramenta whatsapp / comandos /whats e /whatsapp ──► Kira — WhatsApp (ferramenta) ──► WAHA
```

- **Kira — WhatsApp (receber):** webhook do WAHA, guarda as mensagens, detecta menção (@), resposta a mensagem sua ou o seu nome, sugere a resposta e avisa. Limpeza diária às 4h10.
- **Kira — WhatsApp (ferramenta):** status, conectar (QR code ou código), grupos, conversas, ler, buscar, rascunho, rascunhos, editar, enviar, descartar. Só envia rascunhos já guardados (#N).
- **Kira 2.0:** ferramenta `whatsapp` no agente, comandos `/whatsapp` e `/whats`, e as regras do WhatsApp no prompt (enviar só com confirmação na mesma mensagem).
- WAHA: imagem `devlikeapro/waha` (Core, gratuita), motor GOWS, sessão `default`, chave no header `X-Api-Key` (credencial **WAHA (Kira)**).
