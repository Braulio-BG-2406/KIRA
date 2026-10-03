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
7. Opcionais: [Outlook](#7-outlook-e-mails-agenda-e-rascunhos-de-resposta), [Resumo da manhã às 7h](#8-resumo-da-manhã-às-7h), [Google Drive](#9-google-drive-só-leitura), [LinkedIn](#10-linkedin-rascunhos-e-publicar), [Imagens](#11-imagens-com-ia), [Teams](#12-microsoft-teams), [Pedidos](#13-pedidos-base-oficial-do-erp), [Ambientes](#14-ambientes-kira-20), [Rascunhos automáticos](#15-rascunhos-automáticos-de-e-mails-sobre-pedidos), [Internet](#16-internet-pesquisa-no-google), [Assinatura nos rascunhos](#17-assinatura-nos-rascunhos-de-resposta), [Planilha do negócio](#18-planilha-do-negócio-modo-negócios), [Power BI](#19-power-bi-modo-trabalho), [Fim do dia às 18h](#20-fim-do-dia-às-18h), [Saúde da Kira](#21-saúde-da-kira-avisos-de-falha-e-resumo-de-segunda) e [Backup semanal](#22-backup-semanal-google-drive)

---

## 1. Bot do Telegram

A Kira usa uma credencial do Telegram (**Telegram account**) com o token do bot dela. Depois de importar o workflow, selecione essa credencial em todos os nós do Telegram (o gatilho e os de envio e download). O token vem do **@BotFather**:

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
2. No topo do chat aparece que ela está gravando; em seguida chega um áudio **Kira** com algo como *"Bom dia, (seu nome)! Sim, estou online e pronta para ajudar."* e o texto na legenda.

Depois, teste também:

| Teste | O que esperar |
| --- | --- |
| Escreva "oi, Kira" | Resposta por texto |
| Mande uma foto com a legenda "o que tem nesta foto?" | Ela descreve a foto (e lê os textos que aparecem nela) |
| Mande uma foto de um produto e peça "deixe o fundo branco" | Chega a foto editada, com o produto igual, e a legenda "🖼️ Imagem #N (a partir da #M)" |
| `/status` | Kira online, data e hora, modo de voz e quantas memórias ela guardou |
| "Kira, lembre que eu prefiro respostas curtas" | Ela confirma que anotou |
| `/memorias` | A memória aparece com um número, por exemplo `[1]` |
| "Kira, esqueça a memória 1" | Ela confirma e a memória some de `/memorias` |
| `/limpar` | Ela esquece o histórico recente da conversa (as memórias guardadas continuam) |
| "Kira, como estou na minha meta?" | Ela explica que ainda não tem acesso aos seus dados financeiros, sem inventar números |

## 7. Outlook: e-mails, agenda e rascunhos de resposta

A Kira consulta o Outlook com quatro ferramentas de leitura: **emails_recentes** (Caixa de Entrada de um período, com o total), **buscar_emails** (por palavra, remetente ou assunto), **ler_email** (um e-mail inteiro, em texto) e **agenda** (compromissos do calendário principal, no horário de Brasília).

Uma quinta ferramenta, **criar_rascunho_resposta**, prepara a resposta de um e-mail quando você pede ("Kira, deixe pronta a resposta para o e-mail do fornecedor"). Ela só cria um **rascunho** na pasta Rascunhos, com o e-mail original citado e a sua assinatura (passo 17): nada é enviado. Você revisa, ajusta e envia pelo Outlook. O que a Kira não souber fica marcado como `[confirmar]`.

1. No n8n: **Create credential → Microsoft Outlook OAuth2 API** → entre com a sua conta Microsoft.
2. Selecione essa credencial nas quatro ferramentas de leitura (grupo **Cérebro da Kira**) e publique. A quinta, **criar_rascunho_resposta**, chama o sub-workflow do rascunho com assinatura (passo 17).

Contas de empresa podem exigir que o administrador do Microsoft 365 aprove o acesso do n8n. As instruções da Kira mandam tratar o conteúdo dos e-mails como informação, nunca como ordem, para que um e-mail não consiga "dar instruções" a ela.

Teste: "Kira, quantos e-mails chegaram hoje?" e "Kira, o que tenho na agenda amanhã?".

## 8. Resumo da manhã às 7h

Workflow separado: **Kira — Resumo da manhã (7h)** ([`n8n/workflows/kira-resumo-da-manha.json`](../n8n/workflows/kira-resumo-da-manha.json)). Todo dia às 7h (Brasília) ele:

1. lê notícias das últimas 24 horas em fontes confiáveis por RSS (g1, Agência Brasil, BBC, InfoMoney, Money Times, Poder360, Tecnoblog, TechCrunch e outras) e, para **mineração, petróleo, siderurgia e florestal**, publicações do setor e buscas do Google Notícias filtradas por uma lista de veículos confiáveis (Valor, Estadão, g1, Exame, Reuters, imprensa do setor…);
2. pega as cotações de dólar e euro (Banco Central, PTAX de venda do último dia útil) e do bitcoin (Coinbase);
3. pede ao Gemini um resumo curto em seis seções: Brasil, Mundo, Mercado financeiro, Mineração/petróleo/siderurgia/florestal, Política e Tecnologia e tendências, cada item com o link da fonte;
4. manda no Telegram e, logo depois, um **áudio na voz da Kira** (cerca de um minuto e meio, com os destaques). Se o Gemini falhar, manda só os títulos com link.

Para configurar: selecione as credenciais do Telegram (nos três nós de envio) e do Gemini (nos três nós do Gemini); no nó **Configuração do resumo**, preencha `chat_id` (o seu ID do Telegram, o mesmo de `ids_autorizados`) e `nome_dono` (como a Kira chama você); depois publique. As fontes ficam no nó **Fontes** (seção, nome, endereço do RSS e limite) e a lista de veículos aceitos, no nó **Selecionar notícias**. O áudio usa a voz `Kore` e o modelo `gemini-3.8-flash-tts`; para trocar, crie os campos `voz_tts` e `modelo_voz` na **Configuração do resumo**. Tudo usa serviços gratuitos.

## 9. Google Drive (só leitura)

Duas ferramentas: **buscar_arquivos_drive** (por nome ou conteúdo, com filtro por tipo: documento, planilha, apresentação, PDF ou pasta; sem termo, lista os mais recentes) e **ler_arquivo_drive** (lê Documentos, Planilhas e Apresentações do Google e arquivos de texto, até cerca de 20 mil caracteres). PDFs, Word e imagens ainda não são lidos: a Kira manda o link.

1. No n8n: **Create credential → Google Drive OAuth2 API** → entre com a sua conta Google.
2. Selecione a credencial nas duas ferramentas e publique.

Teste: "Kira, quais planilhas eu mexi esta semana?".

## 10. LinkedIn: rascunhos e /publicar

Quando você pede um post, a Kira escreve o texto e guarda na tabela `kira_linkedin` como rascunho numerado (ferramenta **rascunho_linkedin**). **Ela nunca publica sozinha.** O post só vai para o LinkedIn quando você manda `/publicar N` (N é o número do rascunho). Se o rascunho tiver imagem, o post sai com ela.

1. Crie a tabela `kira_linkedin` com as colunas `texto`, `status`, `post_urn`, `erro` (texto) e `imagem_id` (número).
2. No n8n: **Create credential → LinkedIn OAuth2 API** → entre com a sua conta LinkedIn.
3. Nos nós **Publicar no LinkedIn** e **Publicar no LinkedIn (com imagem)** (grupo **Comandos**), selecione a credencial e escolha você mesmo no campo **Person**. Publique.

Teste: "Kira, escreva um post curto sobre produtividade", confira o texto e o número e, se gostar, mande `/publicar N`.

## 11. Imagens com IA

A ferramenta **gerar_imagem** cria imagens com os modelos de imagem do Gemini ("Nano Banana", com a mesma chave gratuita), manda a imagem no Telegram com o número (`🖼️ Imagem #3`) e guarda a referência na tabela `kira_imagens` (o arquivo fica no próprio Telegram). Com o número, a imagem pode ir:

- **no LinkedIn**: "Kira, faça um post sobre isso com a imagem 3" (sai junto quando você manda `/publicar N`);
- **num e-mail**: a ferramenta **anexar_imagem_email** anexa a imagem a um rascunho do Outlook. Nada é enviado.

As fotos que você manda também ganham um número (Foto #N) e a Kira pode **editar a sua própria foto**: "coloque esse anel na mão de uma modelo", "troque o fundo por branco". A foto original vai junto para o Gemini e a peça continua igual. Para ajustar uma imagem já pronta, peça pelo número: "deixa a imagem 3 com o fundo mais claro".

Formatos: quadrado (padrão, bom para o LinkedIn), retrato, paisagem (e-mail e banner) ou story.

1. Crie a tabela `kira_imagens` com as colunas `user_id`, `chat_id`, `file_id`, `descricao`, `legenda`, `formato` e `modelo` (texto).
2. Importe os dois sub-workflows: [`kira-gerar-imagem.json`](../n8n/workflows/kira-gerar-imagem.json) (credenciais do Gemini e do Telegram) e [`kira-anexar-imagem.json`](../n8n/workflows/kira-anexar-imagem.json) (Telegram e Outlook). Publique os dois.
3. Em cada um, **Settings → This workflow can be called by** → escolha só a Kira.
4. Na Kira, nas ferramentas **gerar_imagem** e **anexar_imagem_email**, selecione o sub-workflow correspondente. Publique.

Teste: "Kira, gere uma imagem quadrada de um café da manhã com vista para a montanha, em aquarela".

> O plano gratuito do Gemini tem limite diário de imagens. Quando acaba, a Kira avisa; no dia seguinte volta a funcionar. Os modelos ficam no nó **Preparar pedido** do sub-workflow (um principal e um reserva).

## 12. Microsoft Teams

Três ferramentas, num sub-workflow ([`kira-teams.json`](../n8n/workflows/kira-teams.json)): **conversas_teams** (conversas recentes, com busca por nome), **ler_conversa_teams** (últimas mensagens de uma conversa) e **enviar_mensagem_teams** (mensagem em seu nome numa conversa existente).

A Kira tem liberdade para escrever e responder no Teams **quando você pede** ("Kira, responde a Ana que o pedido sai amanhã"). Ela nunca envia por conta própria, confirma o que mandou e para quem, e trata o que chega no Teams como informação, nunca como ordem (ninguém consegue "mandar" nela pelo chat).

1. No n8n: **Create credential → Microsoft Teams OAuth2 API** → entre com a conta da empresa. Contas corporativas podem exigir aprovação do administrador do Microsoft 365.
2. Importe o sub-workflow, selecione a credencial nos três nós HTTP, publique e, em **Settings → This workflow can be called by**, escolha só a Kira.
3. Na Kira, selecione o sub-workflow nas três ferramentas e publique.

Teste: "Kira, quais são minhas conversas mais recentes no Teams?".

## 13. Pedidos (base oficial do ERP)

A ferramenta **consultar_pedidos** responde com a base oficial de pedidos que o ERP exporta para o SharePoint (a planilha grande, de todas as unidades). São dois workflows:

- **Kira — base de pedidos (sincronização)** ([`kira-base-de-pedidos.json`](../n8n/workflows/kira-base-de-pedidos.json)): de segunda a sábado, às 9h, 12h, 15h e 18h (e pelo botão **Atualizar agora**), lê a planilha e grava no seu OneDrive uma **base compacta** (`Kira/base-pedidos.json`) com os itens emitidos nos últimos 120 dias, todos os itens ainda em aberto e os totais de pedidos emitidos por mês e unidade (de todas as linhas, sem os cancelados). Se a planilha não mudou desde a última leitura, não faz nada. Se falhar, avisa no Telegram e a Kira continua com a última base salva.
- **Kira — pedidos (ferramenta)** ([`kira-pedidos.json`](../n8n/workflows/kira-pedidos.json)): lê a base compacta e devolve só o que interessa à pergunta, sempre com a fonte e a hora da atualização da planilha.

A planilha oficial passa de 250 MB, o limite do Excel Online. Por isso a sincronização não abre o arquivo no Excel: ela baixa a planilha em pedaços, descomprime em JavaScript puro (sem bibliotecas externas) e lê as linhas em etapas de cerca de 35 segundos, guardando o ponto em que parou (o n8n Cloud limita cada nó Code a 60 segundos). Para cerca de 300 MB, leva uns 3 minutos. A mesma credencial do Teams dá acesso ao arquivo e ao OneDrive.

1. Importe a sincronização. Nos nós **Informações da planilha** e **Novo link**, troque `ID_DO_DRIVE` e `ID_DO_ARQUIVO` pelos ids da planilha no SharePoint (Microsoft Graph). Selecione a credencial do Teams nos três nós HTTP e a do Telegram em **Avisar no Telegram**, onde vai também o seu `chat_id`. Se as colunas da sua planilha tiverem outros nomes, ajuste a lista `CAMPOS` no nó **Preparar leitura**.
2. Clique em **Atualizar agora** uma vez (confira em **Executions**) e publique.
3. Importe a ferramenta, selecione a credencial do Teams em **Baixar base**, publique e, em **Settings → This workflow can be called by**, libere a Kira e os rascunhos automáticos.
4. Na Kira, selecione a ferramenta em **consultar_pedidos** e publique.

Tipos de consulta: `pedido` (padrão: tudo o que combinar com o número ou o nome), `abertos`, `atrasados`, `compra`, `solicitacao`, `producao`, `resumo` (só números: itens, valores, situações, unidades e clientes) e `totais` (pedidos emitidos por mês e unidade, por exemplo "agosto 2026"). Um item é considerado fechado quando está FATURADO, ENVIADO ou CANCELADO; atrasado é o item em aberto com o prazo vencido ou com o status "em atraso".

Com isso, "Kira, qual o status do pedido 12345?", "quantos itens estão atrasados por unidade?", "quanto foi emitido em agosto?" ou "deixe pronta a resposta para o e-mail do cliente sobre o pedido 12345" usam os dados reais (a resposta de e-mail continua como rascunho). Pedido antigo e já fechado pode não estar na base; nesse caso a Kira diz isso.

> Os dois workflows guardam no histórico só as execuções com erro: cada leitura passa dezenas de MB entre as etapas e cada consulta baixa a base inteira (alguns MB).

> Os dados da empresa passam pelo Gemini. No plano gratuito, o Google pode usar o conteúdo para melhorar os produtos dele; o plano pago não usa.

## 14. Ambientes (Kira 2.0)

A Kira trabalha em um ambiente por vez: **Trabalho**, **Negócios** ou **Pessoal**. Cada ambiente tem suas memórias, seu histórico de conversa, suas tarefas e seus contatos, e a Kira não mistura informações entre eles sem você autorizar. As memórias marcadas como GERAL valem para todos.

- **Trocar:** mande "modo pessoal", "quero o modo negócios", "/negocios" ou "Kira, mude para o ambiente trabalho" (por texto ou áudio). Ela responde "🗂️ Modo Pessoal ativado." e o ambiente fica salvo até a próxima troca. O `/status` mostra o ambiente ativo. Sem essa confirmação, o ambiente não mudou: a Kira não troca de ambiente no meio de outra conversa e pede o comando curto.
- **Se você pedir algo de outro ambiente**, ela diz de qual ambiente é e pede para trocar (ou para você autorizar naquela mensagem).
- **Tarefas e contatos:** "Kira, anota: ligar para o fornecedor amanhã", "quais são minhas tarefas?", "guarda o contato do Pedro, da loja X". Tudo fica no ambiente ativo.
- **Conversas antigas:** "o que combinamos com aquele cliente?" faz a Kira procurar no histórico do ambiente.

Para configurar:

1. Crie as tabelas `kira_config` (`user_id`, `contexto`), `kira_tarefas` (`user_id`, `contexto`, `titulo`, `detalhes`, `prazo`, `status`) e `kira_contatos` (`user_id`, `contexto`, `nome`, `empresa`, `telefone`, `email`, `notas`), todas com colunas de texto, e acrescente a coluna `contexto` (texto) em `kira_memoria` e `kira_logs`.
2. No nó **Ambientes da Kira**, ajuste o campo `ambientes` (JSON com `codigo`, `nome`, `apelidos` e `descricao` de cada ambiente) e o `ambiente_padrao`. A descrição diz à Kira o que pertence a cada ambiente (por exemplo, Outlook, Teams e pedidos no Trabalho).

As memórias antigas, sem ambiente, são distribuídas pela categoria (`pessoal`, `negocios`, `trabalho`…); as que não se encaixam ficam como GERAL.

## 15. Rascunhos automáticos de e-mails sobre pedidos

Workflow separado: **Kira — rascunhos automáticos (Outlook)** ([`kira-rascunhos-automaticos.json`](../n8n/workflows/kira-rascunhos-automaticos.json)). De segunda a sexta, das 7h às 19h30, a cada 30 minutos:

1. lê os e-mails novos da Caixa de Entrada e separa os que parecem perguntar de pedidos (pedido, TRF, cotação, compra, solicitação, produção, prazo, NF). Pula e-mails automáticos, os que você mesmo mandou e os que você já respondeu;
2. a Kira lê cada um (até 5 por vez), consulta a base de pedidos (passo 13) e escreve a resposta no seu nome, marcando como **[confirmar]** o que a base não tem;
3. cria a resposta como **rascunho** na conversa do e-mail, no Outlook, com a sua assinatura (passo 17). **Nunca envia**;
4. avisa no Telegram: de quem é, o assunto, o resumo da resposta e um link para o rascunho (e se a imagem da assinatura ficou de fora).

Para remetentes de fora da empresa, ela fala só dos pedidos que a pessoa citou, sem dados de outros clientes, custos ou fornecedores. Se o pedido não estiver na base, a resposta diz que você está verificando, sem afirmar que o pedido não existe.

1. Crie a tabela `kira_emails_auto` com as colunas `message_id`, `status` e `motivo` (texto). Cada e-mail é analisado uma vez só; os registros são apagados depois de 10 dias.
2. Importe o workflow e selecione as credenciais: *Microsoft Outlook* (nos dois nós HTTP), *Gemini* (nos dois modelos) e *Telegram* (nos dois avisos).
3. No nó **Configuração**, preencha `nome_dono` (como a Kira chama você), `chat_id` (o seu ID do Telegram) e `ativo_desde` (data e hora a partir da qual os e-mails contam, por exemplo `2026-09-28T07:00:00-03:00`; vazio = últimas 72 horas).
4. Na ferramenta **consultar_pedidos**, selecione o sub-workflow de pedidos e, no nó **Criar rascunho**, o sub-workflow do rascunho com assinatura (passo 17). Nos dois, em **Settings → This workflow can be called by**, libere também este workflow. Publique.

Se o Outlook parar de responder (por exemplo, credencial expirada), a Kira avisa no Telegram no máximo uma vez por dia.

> São cerca de 26 execuções por dia útil no n8n, quase todas rápidas e sem IA; o Gemini só é chamado para os e-mails que parecem ser sobre pedidos.

## 16. Internet (pesquisa no Google)

A ferramenta **pesquisar_internet** faz a Kira pesquisar no Google quando a resposta depende de informação atual: notícias, cotações, preços, clima, leis e normas, empresas, produtos e eventos. Se você mandar um link, ela também lê a página. A resposta vem com a data da informação e as fontes.

Ela usa a própria Busca Google do Gemini, com a **mesma chave gratuita**: não precisa de outra conta nem de outra chave. O sub-workflow ([`kira-pesquisar-internet.json`](../n8n/workflows/kira-pesquisar-internet.json)) tenta um modelo principal e, se ele falhar, um reserva.

1. Importe o sub-workflow, selecione a credencial do Gemini nos dois nós HTTP, publique e, em **Settings → This workflow can be called by**, escolha só a Kira.
2. Na Kira, selecione o sub-workflow na ferramenta **pesquisar_internet** e publique.

Teste: "Kira, como fechou o Ibovespa no último pregão?".

> O plano gratuito tem um limite diário de pesquisas com a Busca Google. Quando acaba, a Kira avisa e responde com o que já sabe. As perguntas vão para o Google, por isso a Kira é instruída a nunca colocar nelas dados internos da empresa nem dados pessoais seus.

## 17. Assinatura nos rascunhos de resposta

A assinatura que você configura no Outlook não entra nos rascunhos criados pela Kira (eles são criados pelo Microsoft Graph, fora do Outlook). Por isso os rascunhos de resposta, os que você pede e os automáticos, passam por um sub-workflow próprio: **Kira — rascunho de resposta com assinatura** ([`kira-rascunho-resposta.json`](../n8n/workflows/kira-rascunho-resposta.json)). Ele cria o rascunho com o texto da Kira, a sua assinatura logo abaixo (a **imagem** e o seu **e-mail**) e o e-mail original citado, como o botão Responder. Nada é enviado.

- A imagem fica no seu Google Drive, em qualquer pasta: o sub-workflow procura a imagem mais recente com um trecho do nome que você escolhe (PNG, JPG ou GIF de até 1 MB; aparece com no máximo 600 px de largura). Para trocar a assinatura, suba a imagem nova com o mesmo trecho no nome: vale a mais recente.
- Sem a imagem no Google Drive, o rascunho sai só com o e-mail: a Kira avisa na conversa (dizendo o nome que procurou) e, nos rascunhos automáticos, o aviso do Telegram traz uma linha sobre isso.
- A Kira termina o texto com a despedida e o seu nome e não repete e-mail, telefone ou cargo, que já estão na assinatura.

1. Importe o sub-workflow. Selecione a credencial *Microsoft Outlook* em **Criar rascunho** e **Anexar imagem da assinatura** e a do Google Drive (passo 9) em **Procurar imagem da assinatura** e **Baixar imagem da assinatura**.
2. No nó **Assinatura**, preencha o seu `email` e, em `imagem_drive`, um trecho do nome da imagem (por exemplo, `ASSINATURA`); se quiser, mude a `largura_maxima`.
3. Publique e, em **Settings → This workflow can be called by**, libere a Kira e os rascunhos automáticos.
4. Na Kira, selecione o sub-workflow em **criar_rascunho_resposta**; nos rascunhos automáticos, no nó **Criar rascunho**. Publique os dois.
5. Suba a imagem para o Google Drive (pelo site ou pelo Google Drive no computador), com o trecho do passo 2 no nome.

Teste: "Kira, deixe pronta uma resposta para o último e-mail do fornecedor dizendo que recebi". O rascunho aparece em Rascunhos com a imagem e o e-mail no fim.

## 18. Planilha do negócio (modo Negócios)

No modo **Negócios**, a ferramenta **consultar_negocio** lê a planilha do seu negócio no Google Drive: um .xlsx que junta os relatórios do sistema de vendas (carteira de clientes, posição de estoque, total de vendas e vendas por vendedora, carregados pelo Power Query), a precificação, os painéis e as configurações. O sub-workflow **Kira — planilha do negócio (ferramenta)** ([`kira-planilha-negocio.json`](../n8n/workflows/kira-planilha-negocio.json)) procura no Drive o arquivo mais recente com o nome configurado, baixa, lê o .xlsx no próprio nó Code (JavaScript puro, sem bibliotecas externas) e devolve só o que interessa à pergunta, com a data do arquivo.

- **Só no modo Negócios.** O ambiente vai para o sub-workflow pelo próprio workflow da Kira (não pela IA). Em qualquer outro ambiente, ele recusa sem abrir a planilha, e a Kira pede para você dizer "modo negócios".
- **Tipos de consulta:** `resumo` (os números dos painéis e os parâmetros), `vendas` (por categoria e produto), `vendedoras` (vendas, comissões e acertos do consignado), `clientes` (carteira, em atraso, a receber e para reativar), `estoque` (por local e status), `sem_estoque`, `ultimas_pecas`, `reposicao` (os mais vendidos com estoque zerado ou no mínimo), `precos` (cotação do dia, regras, tipos de banho e custos de cada peça) e `simular_preco` (por exemplo, "bruto 12,50 peso 3,2 banho 5+CA": calcula varejo, atacado, consignado e margens com as regras e a cotação da planilha).
- **Estrutura esperada:** as abas das bases têm no nome `CARTEIRA DE CLIENTE`, `POSIÇÃO DE ESTOQUE`, `TOTAL DE VENDAS` e `VENDAS POR VENDEDOR`; as outras são `PRECIFICAÇÃO`, `CONFIGURAÇÕES`, `FECHAMENTO VENDEDORAS` e os painéis (`PAINEL ...`, com os cartões em maiúsculas e o número logo abaixo). As colunas são achadas pelo nome do cabeçalho, então mudar a ordem não quebra nada. Os números saem do valor que o Excel calculou e gravou ao salvar.

1. Suba a planilha para o Google Drive (pode ser o .xlsx ou uma Planilha Google).
2. Importe o sub-workflow, selecione a credencial do Google Drive em **Procurar planilha** e **Baixar planilha** e, no nó **Planilha do negócio**, troque `nome_do_arquivo` por um trecho do nome do arquivo (por exemplo, `BD NEGOCIO`).
3. Publique e, em **Settings → This workflow can be called by**, escolha só a Kira.
4. Na Kira, selecione o sub-workflow na ferramenta **consultar_negocio** e publique.

Para a Kira ver dados novos: na planilha, **Dados → Atualizar Tudo**, salve e substitua o arquivo no Google Drive (ou suba uma versão nova com o mesmo trecho no nome: vale a mais recente). Teste no modo Negócios: "Kira, me dá um resumo do negócio", "o que eu preciso repor?" ou "simula o preço de uma peça com bruto 12,50, peso 3,2 g e banho 5+CA".

> As vendas são o total do período do relatório (não dá para separar por mês) e os "dias sem comprar" dos clientes contam até a data de referência da planilha. Como a planilha tem dados de clientes e vendedoras, o sub-workflow não guarda no histórico as execuções que dão certo. Esses dados passam pelo Gemini; no plano gratuito, o Google pode usar o conteúdo para melhorar os produtos dele.

## 19. Power BI (modo Trabalho)

No modo **Trabalho**, a ferramenta **consultar_powerbi** consulta o Power BI da empresa pela API oficial, só leitura: lista os modelos semânticos e os relatórios que a conta conectada vê, mostra as tabelas, colunas e medidas de um modelo e roda consultas **DAX** nele. A resposta vem com o nome do modelo e a hora da última atualização dos dados. O sub-workflow é o **Kira — Power BI (ferramenta)** ([`kira-powerbi.json`](../n8n/workflows/kira-powerbi.json)).

- **Só no modo Trabalho.** O ambiente vai para o sub-workflow pelo workflow da Kira (não pela IA). Em outro ambiente, ele recusa sem chamar a API.
- **Como a Kira pergunta:** primeiro pede a estrutura do modelo (`COLUMNSTATISTICS()` e `INFO.VIEW.MEASURES()`); depois escreve a consulta DAX com os nomes certos, de preferência com as medidas prontas do relatório. Cada consulta devolve no máximo 200 linhas.
- **Conexão renovada sozinha:** a conexão com o Power BI vence a cada hora, e o Power BI avisa isso com um código que o n8n não reconhece para renovar. Por isso, antes de cada consulta, o nó **Renovar conexão (Fabric)** faz uma chamada leve à API do Fabric, que usa a mesma conexão e avisa do jeito padrão: o n8n renova sozinho, sem **Reconnect**.
- **Permissão:** a Kira vê o que a conta conectada vê. Para ler os dados de um modelo pela API, essa conta precisa da permissão de **criar conteúdo (Build)** nele: ser administrador, membro ou colaborador da área de trabalho (**Visualizador não basta**), ou receber essa permissão do dono do modelo (**Gerenciar permissões → Adicionar usuário →** marcar "Permitir que os destinatários criem conteúdo com os dados associados a este modelo semântico"). Relatórios só compartilhados para visualização aparecem na lista, mas a consulta volta "sem permissão" e a Kira explica isso sem inventar números. A opção *Semantic Model Execute Queries REST API* do portal de administração do Power BI precisa estar ligada (vem ligada por padrão).

1. **App no Microsoft Entra ID** (portal.azure.com → **Microsoft Entra ID → Registros de aplicativo → Novo registro**): nome `Kira Power BI`, **Contas somente neste diretório organizacional** e URI de redirecionamento do tipo **Web** com o endereço que o n8n mostra na credencial (**OAuth Redirect URL**; no n8n Cloud, `https://oauth.n8n.cloud/oauth2/callback`). Anote o **ID do aplicativo (cliente)** e o **ID do diretório (locatário)**.
2. Em **Permissões de API → Adicionar uma permissão → Power BI Service → Permissões delegadas**, marque `Dataset.Read.All`, `Report.Read.All` e `Workspace.Read.All`.
3. Em **Certificados e segredos → Novo segredo do cliente**, copie o **Valor** (não o "ID do segredo"). Ele só aparece uma vez: cole direto no n8n, nunca em chats.
4. No n8n, **Credentials → Create credential → OAuth2 API**, com o nome `Power BI`:

   | Campo | Valor |
   | --- | --- |
   | Grant Type | Authorization Code |
   | Authorization URL | `https://login.microsoftonline.com/<ID do diretório>/oauth2/v2.0/authorize` |
   | Access Token URL | `https://login.microsoftonline.com/<ID do diretório>/oauth2/v2.0/token` |
   | Client ID | o ID do aplicativo |
   | Client Secret | o Valor do segredo |
   | Scope | `https://analysis.windows.net/powerbi/api/Dataset.Read.All https://analysis.windows.net/powerbi/api/Report.Read.All https://analysis.windows.net/powerbi/api/Workspace.Read.All offline_access` |
   | Auth URI Query Parameters | `prompt=select_account` |
   | Authentication | Body |

   Clique em **Connect my account**, entre com a conta que vê os modelos e aceite as permissões. Para trocar a conta depois, clique em **Reconnect** e escolha **Usar outra conta**. Se a Microsoft entrar sozinha com a conta que já está aberta no navegador, troque **Auth URI Query Parameters** por `prompt=login&login_hint=<e-mail da conta>`: ela passa a pedir a senha dessa conta.
5. Importe o sub-workflow, selecione a credencial nos 7 nós HTTP, publique e, em **Settings → This workflow can be called by**, escolha só a Kira.
6. Na Kira, selecione o sub-workflow na ferramenta **consultar_powerbi** e publique.

Teste no modo Trabalho: "Kira, quais relatórios do Power BI você vê?" e depois "quanto foi faturado este mês, pelo BI?".

> Os números consultados passam pelo Gemini, como os pedidos e os e-mails; no plano gratuito, o Google pode usar o conteúdo para melhorar os produtos dele. O segredo do app vence no prazo que você escolheu: antes disso, crie um novo e troque na credencial.

## 20. Fim do dia às 18h

Workflow separado: **Kira — Fim do Dia (18h)** ([`kira-fim-do-dia.json`](../n8n/workflows/kira-fim-do-dia.json)). De segunda a sexta, às 18h, a Kira manda no Telegram o resumo do expediente. Só lê: não envia e-mail nem muda nada.

- 📅 **Agenda do próximo dia útil** (na sexta, a de segunda). Compromissos de vários dias, como férias e viagens, aparecem como "dia todo (até dd/mm)".
- 📬 **E-mails de hoje ainda sem resposta**, os importantes primeiro. Ficam de fora os que você já respondeu ou encaminhou, os automáticos (como "não responda" e avisos de sistemas), os que o Outlook separou em **Outros** e os em que você está só em cópia.
- 📝 **Rascunhos para revisar**: os de hoje e o total da pasta.
- ✅ **Tarefas abertas do ambiente de trabalho** (`kira_tarefas`), com as atrasadas marcadas. Só desse ambiente: nada dos outros aparece.
- 📦 **Pedidos atrasados** da base oficial (passo 13), em números e por unidade.

Se uma parte não responder, a mensagem sai mesmo assim, com uma linha dizendo o que faltou.

1. Importe o workflow e selecione as credenciais: *Microsoft Outlook* (nos 4 nós HTTP) e *Telegram* (nos 2 envios).
2. No nó **Configuração do fim do dia**, preencha `nome_dono`, `chat_id` e `user_id` (o seu ID do Telegram, o mesmo da Kira). Se quiser, troque o ambiente (`ambiente` e `ambiente_nome`; padrão Trabalho) e `max_itens` (quantos itens por lista; padrão 8).
3. No nó **Pedidos atrasados**, selecione o sub-workflow de pedidos e, nele, em **Settings → This workflow can be called by**, libere também este workflow. Publique.

## 21. Saúde da Kira (avisos de falha e resumo de segunda)

Workflow separado: **Kira — Saúde (avisos e resumo de segunda)** ([`kira-saude.json`](../n8n/workflows/kira-saude.json)). Ele faz duas coisas:

- **Avisa quando algo falha.** Se a Kira ou uma automação dela parar com erro, chega no Telegram: qual automação, em que passo, o erro, uma dica (por exemplo, "parece que uma conexão venceu: clique em Reconnect") e o link da execução no n8n. É no máximo **um aviso por dia** para cada automação; as outras falhas do mesmo dia só ficam anotadas na tabela `kira_saude` (guardada por 90 dias).
- **Toda segunda às 8h**, manda o resumo da semana: as conexões (Outlook, Google Drive, Gemini, Power BI e LinkedIn), as falhas dos últimos 7 dias por automação, quando a base de pedidos foi atualizada, o último backup (passo 22) e quantos dias faltam para reconectar o LinkedIn. O que precisar de atenção aparece em **Para olhar**.

Ele só lê os serviços e só escreve na tabela `kira_saude`.

1. Crie a tabela `kira_saude` com as colunas `workflow_id`, `workflow`, `no`, `erro`, `execucao_id` e `modo` (texto).
2. Importe o workflow e selecione as credenciais: *Microsoft Outlook* (nó **Outlook**), a mesma da base de pedidos no nó **Base de pedidos (OneDrive)**, *Google Drive*, *Power BI* (nos 2 nós do Power BI), *Gemini*, *LinkedIn* e *Telegram* (nos 3 envios).
3. No nó **Configuração da saúde**, preencha `chat_id` (o seu ID do Telegram) e `linkedin_conectado_em` (o dia em que você conectou o LinkedIn, como `2026-10-02`: a Kira avisa quando faltarem 10 dias para os 60 dias). Em `servicos` ficam os serviços que você usa (`outlook, drive, gemini, powerbi, linkedin, pedidos`): se não usa algum, tire o nome da lista e apague o nó dele. Publique.
4. Em cada automação da Kira (a Kira, o resumo da manhã, os rascunhos automáticos, o fim do dia e o backup), abra **Settings → Error workflow**, escolha **Kira — Saúde (avisos e resumo de segunda)** e salve. Não precisa publicar de novo. A base de pedidos já tem o aviso dela (passo 13).

> Os avisos só valem para as execuções de verdade (as agendadas e as mensagens do Telegram). Testes feitos no editor do n8n não avisam.

## 22. Backup semanal (Google Drive)

Workflow separado: **Kira — Backup semanal (domingo 3h)** ([`kira-backup.json`](../n8n/workflows/kira-backup.json)). Todo domingo às 3h, ele copia as tabelas da Kira (configuração, memórias, tarefas, contatos, histórico das conversas, rascunhos do LinkedIn, imagens, e-mails automáticos e falhas) para um arquivo `kira-backup-AAAA-MM-DD.json` na pasta **Kira - backups** do seu Google Drive. A pasta é criada na primeira vez.

- Ficam os **8 backups mais recentes**; os mais antigos vão para a lixeira do Drive, que os apaga de vez em 30 dias. Ele só mexe nos arquivos `kira-backup-…` dessa pasta.
- Se alguma tabela não abrir, o arquivo é salvo sem ela, a Saúde da Kira avisa no Telegram e os backups antigos não são apagados.
- O arquivo tem os dados dos três ambientes e o histórico das conversas, por isso fica só no seu Google Drive, numa pasta que só você vê. A Kira não lê esse arquivo.
- Os workflows e as credenciais não entram nele: eles ficam no banco do n8n. Na VPS, a cópia deles é a da pasta do n8n (veja [migracao-vps.md](migracao-vps.md)).

1. Importe o workflow e selecione a credencial *Google Drive* nos 5 nós do Drive (**Achar pasta**, **Criar pasta**, **Guardar no Google Drive**, **Backups da pasta** e **Mandar para a lixeira**).
2. Se quiser, troque na **Configuração do backup** o nome da pasta (`pasta`) e quantos backups guardar (`manter`). Publique.
3. Para fazer o primeiro na hora, abra o workflow e clique em **Execute workflow**: a pasta e o arquivo aparecem no Drive.

**Para recuperar uma tabela:** o arquivo traz, em `tabelas`, as linhas de cada tabela com todas as colunas. Dá para recolocar as linhas pelo n8n (com um workflow que lê o arquivo e grava na tabela); peça ajuda se precisar.

## Personalizar

Tudo fica no nó **Configuração da Kira**:

| Campo | Padrão | Para que serve |
| --- | --- | --- |
| `nome_dono` | vazio | Como a Kira chama você. Vazio = o seu primeiro nome no Telegram |
| `ids_autorizados` | vazio | IDs do Telegram liberados, separados por vírgula. Vazio = modo de configuração |
| `modo_voz` | `espelho` | `espelho`: áudio quando você manda áudio, texto quando você escreve. `sempre`: sempre áudio. `nunca`: sempre texto |
| `voz_tts` | `Kore` | Voz do Gemini usada nas respostas faladas |
| `modelo_voz` | `gemini-3.8-flash-tts` | Modelo de voz do Gemini |
| `max_caracteres_voz` | 1500 | Respostas maiores que isso vão por texto |
| `fuso_horario` | `America/Sao_Paulo` | Data e hora que a Kira considera |
| `perfil_dono` | texto | O que a Kira sabe sobre você; entra nas instruções dela |

Os ambientes ficam no nó **Ambientes da Kira** (passo 14).

A personalidade e as regras de comportamento estão em [persona-kira.md](persona-kira.md).

## Onde ver o que aconteceu

- **Data tables → `kira_logs`**: uma linha por mensagem, com entrada, resposta, modo (voz ou texto), erros, tempo de resposta e o número da execução.
- **Executions** (no workflow): o passo a passo de cada execução. Use o `execucao_id` do log para achar a execução certa.
- **Data tables → `kira_memoria`**: as memórias guardadas. Você pode editar ou apagar linhas à mão.
- **Data tables → `kira_saude`**: as falhas anotadas pela Saúde da Kira (passo 21), com o passo e o número da execução.
- **Google Drive → Kira - backups**: os backups semanais das tabelas (passo 22).

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
| `/publicar N` responde que não conseguiu | Credencial do LinkedIn expirou ou o campo **Person** está vazio | Reconecte a credencial e confira o passo 10; o rascunho continua guardado |
| A Kira diz que não consegue ler o Teams ou a base de pedidos | Credencial do Teams expirou, a planilha mudou de lugar ou a sincronização ainda não rodou | Reconecte a credencial *Microsoft Teams*, confira os ids da planilha e rode **Atualizar agora** na sincronização (passos 12 e 13) |
| A Kira diz que a base de pedidos está numa versão antiga | A base foi gerada por uma versão anterior da sincronização | Rode **Atualizar agora** em **Kira — base de pedidos (sincronização)** |
| Chegou no Telegram "Não consegui atualizar a base de pedidos" | A planilha estava sendo salva, mudou de colunas ou a credencial expirou | A Kira segue com a última base; veja a execução com erro e tente **Atualizar agora** |
| O rascunho saiu sem a imagem da assinatura | No Google Drive não há imagem com o trecho de `imagem_drive` no nome, ou ela passa de 1 MB ou não é PNG, JPG ou GIF | Suba a imagem com esse trecho no nome (passo 17); o próximo rascunho já sai com ela |
| O resumo chegou sem o áudio | Limite diário da voz do Gemini | O texto sempre chega; o áudio volta no dia seguinte (veja a execução em **Executions**) |
| A Kira diz que o assunto é de outro ambiente | O ambiente ativo não é o do assunto | Mande "modo <nome>" (o `/status` mostra o ambiente ativo) |
| Não apareceu rascunho para um e-mail sobre pedido | Fora do horário, e-mail sem palavras de pedido, já respondido, ou a Kira decidiu que não precisava de resposta | Veja as execuções de **Kira — rascunhos automáticos** e a tabela `kira_emails_auto` (coluna `motivo`) |
| A Kira diz que não conseguiu pesquisar na internet | Limite diário de pesquisas do plano gratuito ou instabilidade | Tente mais tarde; detalhes nas execuções de **Kira — pesquisar na internet** |
| A Kira diz que não conseguiu gerar a imagem | Limite diário de imagens do plano gratuito ou pedido recusado pelo filtro do Google | Tente amanhã ou mude a descrição; detalhes nas execuções do sub-workflow **Kira — gerar imagem** |
| A Kira diz que não tem permissão para consultar um modelo do Power BI | A conta conectada só pode ver o relatório, sem a permissão de criar conteúdo (Build) no modelo | Peça ao dono do modelo essa permissão (ou para entrar na área de trabalho como colaborador), ou reconecte a credencial com a conta dona dos modelos (passo 19) |
| Ao clicar em **Connect my account**, abre o relatório do Power BI em vez do login da Microsoft | O link do relatório foi colado em **Authorization URL** | Volte esse campo para `https://login.microsoftonline.com/<ID do diretório>/oauth2/v2.0/authorize` e confira a tabela do passo 19 |
| A credencial do Power BI ficou sem login (a Kira diz que a conexão caiu) | Um **Reconnect** começou e o login da Microsoft não foi até o fim | Clique em **Connect my account** de novo e vá até **Aceitar**; o aviso fica verde |
| Erro ao conectar a credencial do Power BI (`AADSTS…`) | `AADSTS900144`: Scope vazio. "Falha na autenticação do cliente" (`AADSTS7000215`): o ID do segredo no lugar do Valor. `AADSTS50011`: endereço de retorno diferente do cadastrado no app | Confira a tabela do passo 19 e o URI de redirecionamento do app |
| "Não consegui processar o seu áudio" | Transcrição sem credencial do Gemini ou modelo indisponível | Selecione a credencial no nó *Transcrever áudio (Gemini)* e confira o modelo |
| "Atingi o limite de uso do Gemini" | Limite por minuto ou por dia do plano gratuito | Espere alguns minutos ou ative o faturamento |
| "Tive um problema técnico" | Credencial ou modelo do Gemini com problema | Abra a execução com erro em **Executions** |
| "Tive um problema técnico" em toda mensagem, depois de uma conversa longa | Histórico da conversa quebrado (o Gemini recusa o pedido com "Bad request") | A Kira reinicia o histórico sozinha e responde; em `kira_logs`, a resposta fica com a nota "histórico reiniciado". Se continuar, mande `/limpar` |
| Ela esqueceu a conversa de agora há pouco | O n8n reiniciou (a memória da conversa fica na memória do n8n) | Normal na 1.0; as memórias guardadas em `kira_memoria` não se perdem |

## Rodar na VPS (opcional)

A Kira também roda no n8n instalado na VPS.

**Instalação rápida (Rocky Linux ou RHEL 9/10):** baixe o script [`vps/instalar.sh`](../vps/instalar.sh) na VPS e rode como root `bash instalar.sh <endereço da VPS>`. Ele instala o Docker, sobe o n8n e o Caddy (HTTPS automático e gratuito, com Let's Encrypt) e cria na própria VPS a chave que protege as credenciais (`/opt/kira/.env`). Guarde uma cópia dessa chave num lugar seguro: sem ela, as credenciais salvas no n8n não abrem. Logo depois, abra o endereço no navegador e crie a conta de dono. Para atualizar o n8n: `cd /opt/kira && docker compose pull && docker compose up -d`.
Para trazer a Kira do n8n Cloud, siga o roteiro [migracao-vps.md](migracao-vps.md).

Pontos de atenção:

1. **Versão do n8n** recente, com suporte a *Data tables*, *AI Agent* e *Google Gemini*.
2. **HTTPS público**: o Telegram só entrega mensagens para endereços HTTPS públicos, nas portas 443, 80, 88 ou 8443. Configure um domínio com certificado válido (por exemplo, com Caddy, Traefik ou Nginx + Let's Encrypt) e a variável `WEBHOOK_URL` do n8n com esse endereço.
3. **VPN**: se o editor do n8n fica acessível só pela VPN, mantenha assim, mas libere publicamente o caminho `/webhook/`, senão o Telegram não alcança a Kira.
4. Crie as tabelas com os mesmos nomes e colunas:
   - `kira_memoria`: `user_id`, `categoria`, `fato` e `contexto` (texto)
   - `kira_logs`: `chat_id`, `user_id`, `usuario`, `tipo_entrada`, `entrada`, `resposta`, `modo_resposta`, `entregue_como`, `status`, `erro`, `execucao_id`, `contexto` (texto) e `latencia_ms` (número)
   - `kira_linkedin` e `kira_imagens`: veja os passos 10 e 11
   - `kira_config`, `kira_tarefas` e `kira_contatos`: veja o passo 14; `kira_emails_auto`: passo 15
5. Importe [`n8n/workflows/kira-1.0.json`](../n8n/workflows/kira-1.0.json) (**Workflows → Import from file**), crie as credenciais dos passos 1 a 3 e preencha o `perfil_dono`. Importe também os sub-workflows das imagens, do Teams, dos pedidos, da internet e do rascunho com assinatura, a sincronização da base de pedidos e o workflow dos rascunhos automáticos (passos 11 a 17).
6. Desative a Kira do n8n Cloud antes de publicar a da VPS (um bot, um webhook).
