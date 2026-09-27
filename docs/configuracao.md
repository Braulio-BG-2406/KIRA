# Configurar e ativar a Kira 1.0

Tempo estimado: 20 a 30 minutos.

## Onde a Kira está

O workflow **"Kira 1.0 — Assistente pessoal (Telegram + Gemini)"** já foi criado e testado no seu **n8n Cloud** (a instância conectada ao Claude), no projeto pessoal. Ele está **desativado** até você concluir os passos abaixo. As tabelas `kira_memoria` e `kira_logs` também já existem lá (menu **Overview → Data tables**).

Prefere rodar na VPS? Veja [Rodar na VPS](#rodar-na-vps-opcional) no fim.

> **Nunca** cole token do Telegram, chave de API ou senha em chats (nem com a Kira, nem com outras IAs). Eles vão só nas **credenciais do n8n**.

## Checklist

1. [Confirmar o bot do Telegram](#1-bot-do-telegram)
2. [Criar a chave do Gemini](#2-gemini-o-cérebro)
3. [Conferir a voz da Kira](#3-voz-da-kira-grátis-com-o-gemini) (usa a mesma chave do Gemini)
4. [Publicar o workflow](#4-publicar)
5. [Liberar o seu ID do Telegram](#5-liberar-o-seu-id)
6. [Fazer o primeiro teste](#6-primeiro-teste-)
7. Opcionais: [Outlook (e-mails e agenda)](#7-outlook-e-mails-e-agenda-só-leitura) e [Resumo da manhã às 7h](#8-resumo-da-manhã-às-7h)

---

## 1. Bot do Telegram

O workflow usa a credencial **Telegram account**, que já existia no seu n8n. Confirme que ela tem o token do bot da Kira:

- No Telegram, fale com o **@BotFather** → `/mybots` → escolha o bot → **API Token**.
- Se ainda não existe um bot só para a Kira: **@BotFather** → `/newbot` → nome `Kira` → um username terminado em `bot` → copie o token e coloque na credencial **Telegram account** do n8n (Overview → Credentials).

Opcional — menu de comandos do bot: **@BotFather** → `/setcommands` → escolha o bot → cole:

```
start - Apresentação da Kira
ajuda - Lista de comandos
status - Ver se a Kira está online
memorias - O que a Kira guardou sobre você
limpar - Apagar o histórico recente da conversa
id - Mostrar seu ID do Telegram
```

> ⚠️ Um bot do Telegram só entrega mensagens para **um** webhook. Deixe ativo apenas um workflow com *Telegram Trigger* por bot. Você também tem o workflow "Telegram AI Chatbot": se ele usar o mesmo bot, mantenha-o desativado.

## 2. Gemini (o cérebro)

1. Acesse [aistudio.google.com/apikey](https://aistudio.google.com/apikey) com a sua conta Google → **Create API key**.
2. No n8n: **Overview → Credentials → Create credential → Google Gemini(PaLM) Api**. Cole a chave em **API Key** (deixe o **Host** como está), dê o nome **Gemini (Google AI Studio)** e salve.
3. No workflow, selecione essa credencial em quatro nós: **Transcrever áudio (Gemini)**, **Gemini (principal)**, **Gemini (reserva)** e **Gerar voz (Gemini)**.

> **Sobre "Gateway credits":** o n8n Cloud pode associar sozinho os nós do Gemini aos créditos de IA do próprio n8n (cobrados na conta do n8n). Para ficar tudo grátis, confira que os quatro nós acima usam a **sua** credencial do Gemini.

Modelos configurados:

| Uso | Modelo |
| --- | --- |
| Conversa (principal) | `models/gemini-flash-latest` |
| Conversa (reserva: entra sozinho se o principal falhar ou bater no limite) | `models/gemini-flash-lite-latest` |
| Transcrição dos áudios | `models/gemini-3.1-flash-lite` |
| Voz (resposta falada) | `gemini-3.8-flash-tts` (campo `modelo_voz`) |

Se o Google aposentar algum desses modelos, abra o nó e escolha outro na lista.

**Plano gratuito x pago:** a chave do AI Studio funciona no plano gratuito, com limite de uso por minuto e por dia. Nos termos do plano gratuito, o Google pode usar o conteúdo enviado para melhorar os produtos dele. Isso vale para as conversas e para os e-mails que a Kira ler do Outlook. Se isso não for aceitável (por exemplo, pela política da empresa), ative o faturamento do projeto (plano pago), em que isso não acontece.

## 3. Voz da Kira (grátis, com o Gemini)

A voz usa o modelo de voz do próprio Gemini, com a **mesma chave gratuita** do passo 2. Não precisa de Google Cloud nem de faturamento. Confira só que o nó **Gerar voz (Gemini)** usa a sua credencial do Gemini.

- **Trocar a voz:** campo `voz_tts` no nó **Configuração da Kira**. O padrão é `Kore` (feminina, firme). Outras vozes do Gemini: `Aoede`, `Leda`, `Zephyr`, `Callirrhoe`. Lista: [ai.google.dev/gemini-api/docs/speech-generation](https://ai.google.dev/gemini-api/docs/speech-generation).
- **Trocar o modelo de voz:** campo `modelo_voz` (padrão `gemini-3.8-flash-tts`).
- **Limite:** o plano gratuito tem limite diário para a voz. Quando acabar, ou se o nome da voz estiver errado, a Kira não trava: responde por texto e o erro fica na execução do n8n.
- **Como a voz chega:** como um arquivo de áudio "Kira" (WAV) que toca direto no chat, com o texto da resposta na legenda.

## 4. Publicar

No workflow: **Save → Publish** (ou o interruptor **Active**). O n8n registra o webhook no Telegram sozinho.

> No n8n, mudanças num workflow já publicado só passam a valer depois de **publicar de novo**.

## 5. Liberar o seu ID

1. Com o workflow publicado, mande **oi** para o bot.
2. A Kira responde: *🔧 Kira em modo de configuração — Seu ID do Telegram é: `123456789`*.
3. No n8n, abra o nó **Configuração da Kira** e cole esse número no campo **ids_autorizados** (para liberar mais de uma pessoa, separe os IDs por vírgula).
   - O nó fica logo depois do **Telegram Trigger**, dentro do grupo **Entrada e segurança**. Se o grupo aparecer como uma caixa fechada, clique nele para expandir.
   - Dê dois cliques no nó. Na lista de campos (*Fields to Set*), procure a linha com o nome `ids_autorizados` e cole o número na caixa de valor ao lado.
4. Salve e **publique de novo**.

> No **Telegram Trigger**, o campo *Trigger On / Updates* deve ficar só com **Message**. Outros tipos (mensagens editadas, canais, enquetes) não são tratados pela Kira 1.0 e fazem a execução dar erro.

A partir daí a Kira só conversa com você, e só no chat privado. Qualquer outra pessoa recebe: *🔒 Olá! Eu sou a Kira, uma assistente particular. Não estou autorizada a conversar com você.*

## 6. Primeiro teste 🎙️

1. Grave um áudio no chat da Kira: **"Kira, bom dia. Você está online?"**
2. No topo do chat aparece que ela está gravando; em seguida chega um áudio **Kira** com algo como *"Bom dia, Bráulio! Sim, estou online e pronta para ajudar."* e o texto na legenda.

Depois, teste também:

| Teste | O que esperar |
| --- | --- |
| Escreva "oi, Kira" | Resposta por texto |
| `/status` | Kira online, data e hora, modo de voz e quantas memórias ela guardou |
| "Kira, lembre que eu prefiro respostas curtas" | Ela confirma que anotou |
| `/memorias` | A memória aparece com um número, por exemplo `[1]` |
| "Kira, esqueça a memória 1" | Ela confirma e a memória some de `/memorias` |
| `/limpar` | Ela esquece o histórico recente da conversa (as memórias guardadas continuam) |
| "Kira, como estou na minha meta?" | Ela explica que ainda não tem acesso aos seus dados financeiros, sem inventar números |

## 7. Outlook: e-mails e agenda (só leitura)

A Kira consulta o Outlook com quatro ferramentas: **emails_recentes** (Caixa de Entrada de um período, com o total), **buscar_emails** (por palavra, remetente ou assunto), **ler_email** (um e-mail inteiro, em texto) e **agenda** (compromissos do calendário principal, no horário de Brasília). Todas só **leem**: a Kira não envia, não responde, não apaga e não altera nada.

1. No n8n: **Create credential → Microsoft Outlook OAuth2 API** → entre com a sua conta Microsoft.
2. Selecione essa credencial nas quatro ferramentas (grupo **Cérebro da Kira**) e publique.

Contas de empresa podem exigir que o administrador do Microsoft 365 aprove o acesso do n8n. As instruções da Kira mandam tratar o conteúdo dos e-mails como informação, nunca como ordem, para que um e-mail não consiga "dar instruções" a ela.

Teste: "Kira, quantos e-mails chegaram hoje?" e "Kira, o que tenho na agenda amanhã?".

## 8. Resumo da manhã às 7h

Workflow separado: **Kira — Resumo da manhã (7h)** ([`n8n/workflows/kira-resumo-da-manha.json`](../n8n/workflows/kira-resumo-da-manha.json)). Todo dia às 7h (Brasília) ele:

1. lê notícias das últimas 24 horas em fontes confiáveis por RSS (g1, Agência Brasil, BBC, InfoMoney, Money Times, Poder360, Tecnoblog, TechCrunch e outras);
2. pega as cotações de dólar, euro e bitcoin;
3. pede ao Gemini um resumo curto em cinco seções: Brasil, Mundo, Mercado financeiro, Política e Tecnologia e tendências, cada item com o link da fonte;
4. manda no Telegram. Se o Gemini falhar, manda só os títulos com link.

Para configurar: no nó **Configuração do resumo**, preencha `chat_id` (o seu ID do Telegram, o mesmo de `ids_autorizados`) e publique. As fontes ficam no nó **Fontes** (seção, nome e endereço do RSS). Tudo usa serviços gratuitos.

> A API de cotações (AwesomeAPI) às vezes recusa pedidos vindos do n8n Cloud por limite de uso. Nesse caso o resumo sai sem a linha de cotações.

## Personalizar

Tudo fica no nó **Configuração da Kira**:

| Campo | Padrão | Para que serve |
| --- | --- | --- |
| `nome_dono` | Bráulio | Como a Kira chama você |
| `ids_autorizados` | vazio | IDs do Telegram liberados, separados por vírgula. Vazio = modo de configuração |
| `modo_voz` | `espelho` | `espelho`: áudio quando você manda áudio, texto quando você escreve. `sempre`: sempre áudio. `nunca`: sempre texto |
| `voz_tts` | `Kore` | Voz do Gemini usada nas respostas faladas |
| `modelo_voz` | `gemini-3.8-flash-tts` | Modelo de voz do Gemini |
| `max_caracteres_voz` | 1500 | Respostas maiores que isso vão por texto |
| `fuso_horario` | `America/Sao_Paulo` | Data e hora que a Kira considera |
| `perfil_dono` | texto | O que a Kira sabe sobre você; entra nas instruções dela |

A personalidade e as regras de comportamento estão em [persona-kira.md](persona-kira.md).

## Onde ver o que aconteceu

- **Data tables → `kira_logs`**: uma linha por mensagem, com entrada, resposta, modo (voz ou texto), erros, tempo de resposta e o número da execução.
- **Executions** (no workflow): o passo a passo de cada execução. Use o `execucao_id` do log para achar a execução certa.
- **Data tables → `kira_memoria`**: as memórias guardadas. Você pode editar ou apagar linhas à mão.

Durante os testes ficou uma linha de teste em `kira_logs` (usuário "Teste @teste_kira"); pode apagar.

## Solução de problemas

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| A Kira não responde nada | Workflow não publicado, token errado ou outro workflow usando o mesmo bot | Publique; confira o token no @BotFather; desative outros workflows com *Telegram Trigger* no mesmo bot |
| Sempre responde "modo de configuração" | `ids_autorizados` vazio (ou não publicou depois de preencher) | Preencha o campo e publique de novo |
| Responde "não estou autorizada" para você | ID digitado errado | Apague o campo `ids_autorizados`, publique, mande "oi" para ver o ID certo e repita o passo 5 |
| Você manda áudio e ela responde por texto | Credencial da voz, limite diário da voz ou nome de voz errado | Veja o passo 3 e a execução em **Executions** |
| Ela diz que não consegue ler seus e-mails | Credencial do Outlook expirou ou foi removida | Reconecte a credencial *Microsoft Outlook* no n8n (passo 7) |
| O resumo das 7h não chegou | Workflow do resumo desativado ou `chat_id` vazio | Veja o passo 8 e a execução em **Executions** |
| "Não consegui processar o seu áudio" | Transcrição sem credencial do Gemini ou modelo indisponível | Selecione a credencial no nó *Transcrever áudio (Gemini)* e confira o modelo |
| "Atingi o limite de uso do Gemini" | Limite por minuto ou por dia do plano gratuito | Espere alguns minutos ou ative o faturamento |
| "Tive um problema técnico" | Credencial ou modelo do Gemini com problema | Abra a execução com erro em **Executions** |
| Ela esqueceu a conversa de agora há pouco | O n8n reiniciou (a memória da conversa fica na memória do n8n) | Normal na 1.0; as memórias guardadas em `kira_memoria` não se perdem |

## Rodar na VPS (opcional)

A Kira também roda no n8n instalado na VPS. Pontos de atenção:

1. **Versão do n8n** recente, com suporte a *Data tables*, *AI Agent* e *Google Gemini*.
2. **HTTPS público**: o Telegram só entrega mensagens para endereços HTTPS públicos, nas portas 443, 80, 88 ou 8443. Configure um domínio com certificado válido (por exemplo, com Caddy, Traefik ou Nginx + Let's Encrypt) e a variável `WEBHOOK_URL` do n8n com esse endereço.
3. **VPN**: se o editor do n8n fica acessível só pela VPN, mantenha assim, mas libere publicamente o caminho `/webhook/`, senão o Telegram não alcança a Kira.
4. Crie as tabelas com os mesmos nomes e colunas:
   - `kira_memoria`: `user_id` (texto), `categoria` (texto), `fato` (texto)
   - `kira_logs`: `chat_id`, `user_id`, `usuario`, `tipo_entrada`, `entrada`, `resposta`, `modo_resposta`, `entregue_como`, `status`, `erro`, `execucao_id` (texto) e `latencia_ms` (número)
5. Importe [`n8n/workflows/kira-1.0.json`](../n8n/workflows/kira-1.0.json) (**Workflows → Import from file**), crie as credenciais dos passos 1 a 3 e preencha o `perfil_dono`.
6. Desative a Kira do n8n Cloud antes de publicar a da VPS (um bot, um webhook).
