# Configurar e ativar a Kira 1.0

Tempo estimado: 20 a 30 minutos.

## Onde a Kira está

O workflow **"Kira 1.0 — Assistente pessoal (Telegram + Gemini)"** já foi criado e testado no seu **n8n Cloud** (a instância conectada ao Claude), no projeto pessoal. Ele está **desativado** até você concluir os passos abaixo. As tabelas `kira_memoria` e `kira_logs` também já existem lá (menu **Overview → Data tables**).

Prefere rodar na VPS? Veja [Rodar na VPS](#rodar-na-vps-opcional) no fim.

> **Nunca** cole token do Telegram, chave de API ou senha em chats (nem com a Kira, nem com outras IAs). Eles vão só nas **credenciais do n8n**.

## Checklist

1. [Confirmar o bot do Telegram](#1-bot-do-telegram)
2. [Criar a chave do Gemini](#2-gemini-o-cérebro)
3. [Ligar a voz da Kira](#3-voz-da-kira-google-cloud-text-to-speech) (opcional, mas é o que faz ela responder falando)
4. [Publicar o workflow](#4-publicar)
5. [Liberar o seu ID do Telegram](#5-liberar-o-seu-id)
6. [Fazer o primeiro teste](#6-primeiro-teste-)

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
3. No workflow, selecione essa credencial em três nós: **Transcrever áudio (Gemini)**, **Gemini (principal)** e **Gemini (reserva)**.

> **Sobre "Gateway credits":** ao criar o workflow, o n8n Cloud associou sozinho os nós *Gemini (principal)* e *Gemini (reserva)* aos créditos de IA do próprio n8n (cobrados na conta do n8n, não na sua chave do Google). Os testes rodaram assim. Para usar só a sua chave, troque a credencial desses dois nós para **Gemini (Google AI Studio)**.

Modelos configurados:

| Uso | Modelo |
| --- | --- |
| Conversa (principal) | `models/gemini-3-flash-preview` |
| Conversa (reserva: entra sozinho se o principal falhar ou bater no limite) | `models/gemini-3.1-flash-lite` |
| Transcrição dos áudios | `models/gemini-3.1-flash-lite` |

Se o Google aposentar algum desses modelos, abra o nó e escolha outro na lista.

**Plano gratuito x pago:** a chave do AI Studio funciona no plano gratuito, com limite de uso por minuto e por dia. Nos termos do plano gratuito, o Google pode usar o conteúdo enviado para melhorar os produtos dele. Quando a Kira passar a ver dados das empresas (Kira 2.0), o recomendado é ativar o faturamento do projeto (plano pago), em que isso não acontece.

## 3. Voz da Kira (Google Cloud Text-to-Speech)

Sem este passo a Kira funciona normalmente, mas responde os seus áudios **por texto**. Para ela responder **falando**:

1. Entre em [console.cloud.google.com](https://console.cloud.google.com) e selecione (ou crie) um projeto.
2. **APIs e serviços → Biblioteca** → procure **Cloud Text-to-Speech API** → **Ativar**.
3. O Google exige uma conta de faturamento vinculada ao projeto para essa API. Há uma cota gratuita mensal que costuma cobrir com folga o uso pessoal; confira os valores atuais em [cloud.google.com/text-to-speech/pricing](https://cloud.google.com/text-to-speech/pricing).
4. **APIs e serviços → Credenciais → Criar credenciais → Chave de API**. Em seguida, **Editar chave → Restrições de API → Restringir chave → Cloud Text-to-Speech API** → Salvar.
5. No n8n: **Create credential → Google Gemini(PaLM) Api** (é o mesmo tipo de credencial do Gemini, só muda a chave). Cole a chave, dê o nome **Google Cloud TTS** e salve. O teste de conexão do n8n pode acusar erro, porque ele testa o endereço do Gemini e não o de voz; pode salvar mesmo assim.
6. No workflow, selecione **Google Cloud TTS** no nó **Gerar voz (Google TTS)**.

> **Atenção ao projeto:** se você ativar o faturamento no **mesmo** projeto da chave do Gemini, o Gemini desse projeto também passa para o plano pago. Para manter o Gemini gratuito, use um projeto separado só para a voz.

**Trocar a voz:** campo `voz_tts` no nó **Configuração da Kira**. O padrão é `pt-BR-Chirp3-HD-Kore` (feminina). Outras opções femininas em português, por exemplo: `pt-BR-Chirp3-HD-Aoede`, `pt-BR-Chirp3-HD-Leda`, `pt-BR-Neural2-A`. Lista oficial: [cloud.google.com/text-to-speech/docs/voices](https://cloud.google.com/text-to-speech/docs/voices). Se o nome da voz estiver errado, a Kira não trava: ela manda a resposta por texto e o erro fica registrado em `kira_logs`.

**Como a voz chega:** como um áudio chamado "Kira" que toca direto no chat, com o texto da resposta na legenda.

## 4. Publicar

No workflow: **Save → Publish** (ou o interruptor **Active**). O n8n registra o webhook no Telegram sozinho.

> No n8n, mudanças num workflow já publicado só passam a valer depois de **publicar de novo**.

## 5. Liberar o seu ID

1. Com o workflow publicado, mande **oi** para o bot.
2. A Kira responde: *🔧 Kira em modo de configuração — Seu ID do Telegram é: `123456789`*.
3. No n8n, abra o nó **Configuração da Kira** e cole esse número no campo **ids_autorizados** (para liberar mais de uma pessoa, separe os IDs por vírgula).
4. Salve e **publique de novo**.

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

## Personalizar

Tudo fica no nó **Configuração da Kira**:

| Campo | Padrão | Para que serve |
| --- | --- | --- |
| `nome_dono` | Bráulio | Como a Kira chama você |
| `ids_autorizados` | vazio | IDs do Telegram liberados, separados por vírgula. Vazio = modo de configuração |
| `modo_voz` | `espelho` | `espelho`: áudio quando você manda áudio, texto quando você escreve. `sempre`: sempre áudio. `nunca`: sempre texto |
| `voz_tts` | `pt-BR-Chirp3-HD-Kore` | Voz usada nas respostas faladas |
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
| Você manda áudio e ela responde por texto | Voz não configurada ou com erro | Veja o passo 3 e a coluna `erro` em `kira_logs` |
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
