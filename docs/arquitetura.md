# Arquitetura da Kira

## Visão geral

A Kira é um **agente central** que roda no n8n e conversa pelo Telegram, por texto e voz. Desde a 2.0 ela trabalha em **ambientes** separados: um ativo por vez, cada um com suas memórias, histórico, tarefas e contatos.

```
                    ┌──────────────────────────┐
                    │           n8n            │
                    │   KIRA · agente central  │
                    │     (Google Gemini)      │
                    └────────────┬─────────────┘
                                 │ um ambiente ativo por vez ("modo <nome>")
           ┌─────────────────────┼─────────────────────┐
           │                     │                     │
     🏢 TRABALHO            💼 NEGÓCIOS            👤 PESSOAL
   Outlook, Teams,        clientes, vendas,      agenda, estudos,
   pedidos (ERP),         estoque e preços       rotina, notícias,
   Power BI, rascunhos    (planilha do negócio)  Google Drive
           │                     │                     │
           └── memórias, histórico, tarefas e contatos separados ──┘

   📱 Telegram ──► n8n ──► Gemini ──► Kira ──► 📱 Telegram
   🎙️ voz ou 💬 texto                    🔊 voz ou 💬 texto

   Em paralelo: ☀️ resumo das 7h · 📝 rascunhos automáticos de e-mails sobre pedidos
                · 📦 sincronização da base oficial de pedidos (seg a sáb, 4x ao dia)
                · 🌙 fim do dia (seg a sex, 18h) · 🩺 saúde (avisos de falha e resumo de segunda)
                · 💾 backup das tabelas no Google Drive (domingo, 3h)
```

## Caminho de uma mensagem

Os nomes em **negrito** são os nós do workflow [`n8n/workflows/kira-1.0.json`](../n8n/workflows/kira-1.0.json).

1. **Telegram Trigger** recebe a mensagem (webhook do bot).
2. **Configuração da Kira** acrescenta as configurações (nome, IDs liberados, modo de voz, voz, fuso, perfil).
3. **Normalizar entrada** extrai chat, usuário, texto (ou a legenda da foto) e tipo (`comando`, `voz`, `texto`, `imagem` ou `outro`), confere se o usuário está liberado e decide se a resposta vai por voz.
4. **É você?** — quem não está em `ids_autorizados` (ou escreve fora do chat privado) recebe **Resposta: acesso negado**. Com a lista vazia, essa resposta mostra o ID da pessoa (modo de configuração).
5. **Mostrar "digitando…"** mostra *digitando* ou *gravando voz* no Telegram. Em seguida, **Ambientes da Kira** (a lista de ambientes e o padrão) → **Buscar ambiente** (tabela `kira_config`) → **Ambiente atual** descobrem em qual ambiente a Kira está com você.
6. **Tipo de mensagem** separa o caminho:
   - **Comando** → **É /publicar?** / **É /limpar?** → **Buscar memórias (comandos)** → **Resposta do comando**.
     - `/limpar`: **Limpar histórico da conversa** antes de responder.
     - `/publicar N`: **Buscar rascunho (LinkedIn)** → **Rascunho encontrado?** → **Rascunho tem imagem?** → sem imagem, **Publicar no LinkedIn**; com imagem, **Buscar imagem (LinkedIn)** → **Baixar imagem (LinkedIn)** (do Telegram) → **Publicar no LinkedIn (com imagem)**. Depois, **Marcar como publicado**.
   - **Voz** → **Baixar áudio** → **Transcrever áudio (Gemini)**.
   - **Texto** → segue direto.
   - **Imagem** (foto, ou imagem enviada como arquivo) → **Baixar imagem** (a maior versão da foto) → **Analisar imagem (Gemini)**: o leitor de imagens descreve a foto e transcreve os textos que aparecem nela. A pergunta para a Kira é a legenda (ou "o que tem nesta foto?") mais essa descrição.
   - **Outro** (documento, vídeo, figurinha…) → **Resposta: tipo não suportado**.
7. **Pergunta** → **Detectar troca de ambiente** → **Trocar ambiente?**: mensagens curtas como "modo pessoal", "quero o modo negócios" ou "/negocios" trocam o ambiente (**Salvar ambiente** → **Resposta: ambiente ativado**); nos áudios, também vale "moto pessoal", um erro comum da transcrição. Nas outras, **Buscar memórias** → **Memórias do ambiente** (só as do ambiente ativo e as gerais) → **Contexto da conversa** montam o que a Kira precisa: a pergunta, a data e hora, o perfil, o ambiente e as memórias.
8. **Kira** (AI Agent) responde usando:
   - **Gemini (principal)** e **Gemini (reserva)**: se o principal falhar, a reserva assume;
   - **Memória da conversa**: as últimas 20 trocas, separadas por ambiente;
   - ferramentas **salvar_memoria** e **apagar_memoria** (tabela `kira_memoria`, com o ambiente de cada memória);
   - **buscar_conversas**, **criar_tarefa**, **listar_tarefas**, **concluir_tarefa**, **salvar_contato** e **buscar_contatos**: sempre do seu usuário e do ambiente ativo (tabelas `kira_logs`, `kira_tarefas` e `kira_contatos`);
   - ferramentas do Outlook: **emails_recentes**, **buscar_emails**, **ler_email** e **agenda** (leitura), pelo Microsoft Graph, e **criar_rascunho_resposta** (só rascunho, com a assinatura do dono; sub-workflow abaixo);
   - ferramentas do Google Drive, só leitura: **buscar_arquivos_drive** e **ler_arquivo_drive**;
   - **rascunho_linkedin**: guarda o post (e o número da imagem, se houver) em `kira_linkedin`;
   - **gerar_imagem** e **anexar_imagem_email**: chamam os sub-workflows de imagem (abaixo);
   - **conversas_teams**, **ler_conversa_teams** e **enviar_mensagem_teams**: sub-workflow do Teams;
   - **consultar_pedidos**: sub-workflow que lê a base compacta de pedidos, gerada a partir da planilha oficial do ERP (abaixo);
   - **pesquisar_internet**: sub-workflow que pesquisa com a Busca Google do Gemini e devolve a resposta com as fontes;
   - **consultar_negocio**: sub-workflow que lê a planilha do negócio no Google Drive, só no modo Negócios (abaixo).
9. **Resposta da Kira** (ou **Resposta de erro**, se a transcrição, a leitura da foto ou a IA falharem) padroniza a resposta.
   - Se o Gemini recusar o pedido por causa do histórico ("Bad request"), **Histórico quebrado?** → **Últimas conversas** (as últimas trocas deste chat e ambiente em `kira_logs`) → **Resumo das últimas conversas** → **Reiniciar histórico** (a memória da conversa passa a ter só esse resumo) → **Repetir a pergunta** → **Kira** de novo, uma vez só. A resposta é registrada com a nota "histórico reiniciado".
10. **Resposta pronta** decide voz ou texto e prepara o texto falado e a legenda.
    - Voz: **Gerar voz (Gemini)** → **Preparar áudio (WAV)** → **Áudio para arquivo** → **Enviar áudio**.
    - Texto: **Dividir mensagem** (Markdown → HTML do Telegram, em partes de até 3.500 caracteres) → **Enviar texto** (→ **Enviar texto sem formatação**, se o Telegram recusar a formatação).
    - Se a voz falhar, a resposta vai por texto.
11. **Registrar conversa** grava tudo em `kira_logs`, com o ambiente.

### Sub-workflows (ferramentas)

- **Kira — gerar imagem (ferramenta)**: **Preparar pedido** (descrição, formato e modelo) → **Registrar imagem** (`kira_imagens`, para ter o número) → **Gerar imagem (Gemini)** (se falhar, **Gerar imagem (reserva)** com outro modelo) → **Extrair imagem** → **Imagem para arquivo** → **Enviar imagem** (foto no Telegram, legenda "🖼️ Imagem #N") → **Guardar arquivo** (o `file_id` do Telegram) → **Imagem pronta**. Qualquer falha cai em **Explicar falha**, que devolve à Kira um motivo curto (por exemplo, fim da cota gratuita).
- **Kira — anexar imagem ao e-mail (ferramenta)**: **Buscar imagem** (só do próprio usuário) → **Baixar imagem** (do Telegram) → **Imagem em base64** → **Anexar ao rascunho** (Microsoft Graph, anexo do rascunho) → **Anexo pronto**.
- **Kira — Teams (ferramenta)**: **Qual ação?** separa listar, ler e enviar. Listar: **Buscar conversas** (Graph, com participantes e última mensagem) → **Resumir conversas** (tira o dono da lista, filtra por nome, ordena pela mais recente). Ler: **Buscar mensagens** → **Resumir mensagens** (texto limpo, em ordem). Enviar: **Preparar envio** (HTML seguro) → **Enviar mensagem** → **Mensagem enviada**. Erros viram **Explicar falha**.
- **Kira — pesquisar na internet (ferramenta)**: **Preparar pesquisa** (a pergunta, a data de hoje e as regras; liga a Busca Google e, se houver link, a leitura da página) → **Pesquisar (Gemini + Google)** (se falhar, **Pesquisar (reserva)** com outro modelo) → **Extrair resposta** (o texto final, sem os "pensamentos" do modelo, e até 6 fontes sem repetição). Falhas viram **Explicar falha** (por exemplo, fim da cota gratuita).
- **Kira — pedidos (ferramenta)**: **Baixar base** (a base compacta do OneDrive, como texto) → **Consultar base** (busca por número ou nome; tipos pedido, abertos, atrasados, compra, solicitação, produção, resumo e totais por mês e unidade; junta as linhas do mesmo item, que a planilha repete por NF ou ordem de compra; devolve só os campos úteis, a fonte, a hora da planilha e a cobertura). Erros viram **Explicar falha**.
- **Kira — planilha do negócio (ferramenta)**: **Só no modo Negócios** (o ambiente vem do workflow da Kira; fora de Negócios, **Fora do modo Negócios** recusa sem abrir nada) → **Planilha do negócio** (trecho do nome do arquivo) → **Procurar planilha** (Google Drive, .xlsx ou Planilha Google) → **Escolher planilha** (a mais recente com o nome) → **Baixar planilha** → **Planilha em base64** → **Consultar planilha** (lê o .xlsx no próprio nó: descompressão em JavaScript puro, abas pelo nome, colunas pelo cabeçalho, formatos de R$, % e data pelo estilo das células; devolve só o que a pergunta pede, com a data do arquivo). Erros viram **Explicar falha**.
- **Kira — Power BI (ferramenta)**: **Só no ambiente de trabalho** (o ambiente vem do workflow da Kira; fora dele, **Fora do ambiente de trabalho** recusa sem chamar a API) → **Renovar conexão (Fabric)** (chamada leve que faz o n8n renovar o token vencido: o Power BI responde 403 quando ele vence, e o n8n só renova com 401) → **Listar áreas de trabalho** (API do Power BI com a credencial OAuth2) → **Áreas de trabalho** (o "Meu workspace" e até 30 áreas) → **Listar modelos** e **Listar relatórios** de cada área → **Escolher modelo** (catálogo dos modelos com os relatórios que usam cada um, inclusive os só compartilhados com o dono; acha o modelo pelo nome dele ou de um relatório e aceita só DAX que começa com `EVALUATE` ou `DEFINE`) → **Consultar o modelo?** → **Última atualização** → **Executar DAX** (`executeQueries`; na estrutura, `COLUMNSTATISTICS()`) → **É estrutura?** → **Listar medidas** (`INFO.VIEW.MEASURES()`) → **Montar resultado** (tabelas e colunas sem as internas de datas, medidas, no máximo 200 linhas, hora da última atualização; falta de permissão vira uma orientação). Falhas de conexão viram **Explicar falha**.
- **Kira — rascunho de resposta com assinatura (ferramenta)**: **Assinatura** (e-mail e trecho do nome da imagem) → **Procurar imagem da assinatura** (Google Drive: a imagem PNG, JPG ou GIF mais recente com o trecho no nome) → **Achou a imagem?** (até 1 MB) → **Baixar imagem da assinatura** → **Imagem em base64** → **Montar resposta** (lê largura e altura do cabeçalho do PNG, JPG ou GIF, limita a 600 px e monta o HTML: texto, imagem pelo `cid` e e-mail) → **Criar rascunho** (`createReply` com o texto) → **Tem imagem?** → **Anexar imagem da assinatura** (anexo *inline* com o mesmo `cid`) → **Rascunho pronto**. Sem a imagem, o rascunho sai só com o e-mail e um aviso. Usado pela Kira e pelos rascunhos automáticos.

### Base oficial de pedidos (workflow separado)

**Kira — base de pedidos (sincronização)**, de segunda a sábado às 9h, 12h, 15h e 18h, ou pelo botão **Atualizar agora**: **Informações da planilha** (tamanho, versão e um link de download temporário) → **Preparar leitura** (pula se a planilha não mudou e a base de hoje já foi gerada; monta o estado inicial: colunas a guardar, 120 dias, o que conta como fechado) → **Ler bloco** → **Terminou?** → não: **Novo link** (link novo, porque o anterior expira) → **Ler bloco** de novo; sim: **Montar base** → **Salvar no OneDrive** (`Kira/base-pedidos.json`) → **Registrar**. Se algo falhar, **Se a atualização falhar** → **Avisar no Telegram**.

**Ler bloco** é o coração: o `.xlsx` é um ZIP; na primeira volta ele lê o índice do ZIP (com suporte a ZIP64) e acha a aba de dados (a maior) e os textos compartilhados. A cada volta, baixa 8 MB da aba (pedido com `Range`), descomprime em fluxo com o trecho de descompressão do **fflate** (JavaScript puro, licença MIT, embutido no nó porque o n8n Cloud não libera `zlib`), separa as linhas completas do XML e passa cada uma por **extrairLinha**, que soma os totais do mês e da unidade (cada item uma vez só) e guarda os itens recentes ou em aberto. Depois de uns 35 segundos, devolve o estado (posição no arquivo, o descompressor serializado, o pedaço de linha incompleto e os totais) para a próxima volta. Se a planilha for salva de novo no meio da leitura, recomeça uma vez com a versão nova.

**Montar base** junta as linhas de todas as voltas e guarda os textos repetidos (cliente, material, situação…) num dicionário por coluna: numa planilha com centenas de milhares de linhas, a base fica com dezenas de milhares de itens e poucos MB.

### Rascunhos automáticos (workflow separado)

**Kira — rascunhos automáticos (Outlook)**, de segunda a sexta, das 7h às 19h30, a cada 30 minutos: **Configuração** → **Quem sou eu** (seu endereço, para reconhecer e-mails seus e remetentes de fora) → **Buscar e-mails novos** (Caixa de Entrada, só depois de `ativo_desde`, com a marca de "já respondido") → **Já processados** (`kira_emails_auto`) → **Separar e-mails** (pula os já vistos, automáticos, seus, já respondidos e os que não falam de pedidos; até 5 por vez) → **Kira prepara a resposta** (agente com **consultar_pedidos**, devolve JSON) → **Interpretar resposta** → **Tem resposta?** → **Criar rascunho** (sub-workflow do rascunho com assinatura, um e-mail por vez; devolve a chave do e-mail como `referencia`) → **Resultado do rascunho** → **Registrar e-mail** e **Montar aviso** → **Avisar no Telegram**. Falha da IA por limite de uso não é registrada (o e-mail volta na próxima rodada); outras falhas são registradas e avisadas. Se o Outlook falhar, **Falha já avisada hoje?** garante no máximo um aviso por dia.

### Fim do dia (workflow separado)

**Kira — Fim do Dia (18h)**, de segunda a sexta às 18h: **Configuração do fim do dia** (o dono, o ambiente de trabalho, hoje e o próximo dia útil, que na sexta é a segunda) → **Quem sou eu** → **E-mails de hoje** (com a marca de "já respondido" e a classificação Destaques/Outros) → **Rascunhos** → **Agenda do próximo dia útil** (no fuso do Brasil) → **Tarefas abertas** (`kira_tarefas`, só do ambiente de trabalho) → **Pedidos atrasados** (o sub-workflow de pedidos, tipo `atrasados`) → **Montar mensagem** → **Enviar fim do dia** (se o HTML falhar, **Enviar sem formatação**) → **Conferência (só números)**. Cada leitura segue mesmo com erro; o que falhou vira uma linha "Não consegui ler".

### Saúde da Kira (workflow separado)

**Kira — Saúde (avisos e resumo de segunda)** tem dois gatilhos, que passam pela **Configuração da saúde** e se separam em **Veio de uma falha?**:

- **Quando algo falhar** (*Error Trigger*: a Kira, o resumo, os rascunhos, o fim do dia e o backup apontam para este workflow em **Settings → Error workflow**) → **Resumir falha** (automação, passo, erro, dica e link da execução, em HTML seguro) → **Já avisei hoje?** (`kira_saude`, mesmo workflow desde a meia-noite) → **Anotar falha** → **Primeiro aviso de hoje?** → **Avisar no Telegram**.
- **Segunda às 8h** → uma leitura simples em cada serviço (**Outlook**, **Base de pedidos (OneDrive)**, **Google Drive e último backup**, **Renovar conexão (Power BI)** e **Power BI**, **Gemini**, **LinkedIn**; todas seguem mesmo com erro) → **Falhas da semana** (`kira_saude`) → **Montar relatório** → **Enviar relatório** (ou **Enviar sem formatação**) → **Conferência (só números)** → **Limpar falhas antigas** (mais de 90 dias e as anotações de teste).

### Backup semanal (workflow separado)

**Kira — Backup semanal (domingo 3h)**: **Configuração do backup** → **Ler** cada tabela (`kira_config`, `kira_memoria`, `kira_tarefas`, `kira_contatos`, `kira_logs`, `kira_linkedin`, `kira_imagens`, `kira_emails_auto` e `kira_saude`; uma que falhar não para as outras) → **Achar pasta** → **Pasta já existe?** (se não, **Criar pasta**) → **Pasta do backup** → **Montar backup** (um JSON com as linhas de cada tabela e as contagens) → **Guardar no Google Drive** → **Conferência (só números)** (se faltou alguma tabela, para com erro: a Saúde avisa e os antigos ficam) → **Backups da pasta** → **Escolher os antigos** (além dos 8 mais recentes) → **Mandar para a lixeira**. As execuções que dão certo não ficam guardadas no n8n (o arquivo já está no Drive).

## Dados

| Tabela | Colunas | Para que serve |
| --- | --- | --- |
| `kira_memoria` | `user_id`, `contexto` (ambiente ou `GERAL`), `categoria` (tipo: preferência, decisão, cliente…), `fato` | Memórias de longo prazo. A Kira lê as 100 mais recentes e usa só as do ambiente ativo e as gerais |
| `kira_logs` | `chat_id`, `user_id`, `usuario`, `tipo_entrada`, `entrada`, `resposta`, `modo_resposta`, `entregue_como`, `status`, `erro`, `latencia_ms`, `execucao_id`, `contexto` | Histórico e diagnóstico de cada mensagem; também é onde **buscar_conversas** procura |
| `kira_config` | `user_id`, `contexto` | O ambiente ativo de cada usuário |
| `kira_tarefas` | `user_id`, `contexto`, `titulo`, `detalhes`, `prazo`, `status` (`aberta` ou `concluida`) | Tarefas por ambiente |
| `kira_contatos` | `user_id`, `contexto`, `nome`, `empresa`, `telefone`, `email`, `notas` | Contatos por ambiente |
| `kira_emails_auto` | `message_id`, `status` (`rascunho`, `ignorado` ou `erro`), `motivo` | E-mails já analisados pelos rascunhos automáticos (guardados por 10 dias) |
| `kira_linkedin` | `texto`, `status` (`pendente` ou `publicado`), `post_urn`, `erro`, `imagem_id` | Rascunhos de posts; o `id` é o número usado no `/publicar N` |
| `kira_imagens` | `user_id`, `chat_id`, `file_id`, `descricao`, `legenda`, `formato`, `modelo` | Imagens geradas; o `id` é o número da imagem (#N) e o arquivo fica no Telegram (`file_id`) |
| `kira_saude` | `workflow_id`, `workflow`, `no`, `erro`, `execucao_id`, `modo` | Falhas das automações, anotadas pela Saúde da Kira (guardadas por 90 dias); a primeira do dia de cada automação vira aviso |

Todas as tabelas também têm `id`, `createdAt` e `updatedAt`, criados pelo n8n.

## Decisões e porquês

**Fotos pelo leitor de imagens.** A foto não vai anexada para o agente: na integração do n8n com o Gemini (LangChain), modelos com nome como `gemini-flash-latest` não são reconhecidos como modelos que veem imagens, e o agente recusa a foto ("This model does not support images"). Por isso a foto segue o mesmo caminho do áudio: o nó *Analyze image* do Gemini descreve a imagem e transcreve os textos, e a descrição vai com a legenda para a Kira. Como a descrição entra no histórico da conversa, dá para fazer perguntas sobre a foto depois.

**Transcrição com o Gemini.** O mesmo Gemini que conversa também entende áudio. O nó usa a operação *Analyze audio* com uma instrução em português ("transcreva literalmente…; se não houver fala, responda [inaudível]"), o que dá uma transcrição limpa, sem rótulos.

**Voz com o próprio Gemini, grátis.** O modelo de voz do Gemini (`gemini-3.8-flash-tts`) funciona com a mesma chave gratuita do AI Studio, sem Google Cloud nem faturamento. Ele devolve WAV pronto (modelos mais antigos devolvem áudio cru, PCM); o nó *Preparar áudio (WAV)* acrescenta o cabeçalho WAV quando precisa e calcula a duração. A versão anterior usava o Google Cloud Text-to-Speech, que exige faturamento.

**Outlook só para leitura, pelo Microsoft Graph.** As quatro ferramentas são requisições GET com a credencial OAuth do Outlook. Usar a API direto (em vez do nó pronto do Outlook) permite: ler só a Caixa de Entrada em ordem de chegada e com o total do período (`$count`), receber o corpo do e-mail como texto (menos tokens) e a agenda já no horário de Brasília, só do calendário principal. As instruções mandam consultar de novo a cada pergunta e tratar e-mails como informação, nunca como ordem.

**Nada sai em seu nome sem você.** E-mails viram rascunho (`createReply`, nunca envio), já com a assinatura do dono, e posts ficam em `kira_linkedin` até você mandar `/publicar N`. A publicação é um ramo fixo do workflow, disparado só pelo comando: a IA não tem uma ferramenta de publicar.

**Imagens guardadas no próprio Telegram.** A imagem gerada vai para você como foto; o `file_id` que o Telegram devolve fica em `kira_imagens`. Para o LinkedIn ou um e-mail, o workflow baixa a imagem do Telegram de novo. Assim não é preciso outro armazenamento (nem dar à Kira acesso de escrita ao Drive), e a imagem usada é a mesma que você viu. O anexo do e-mail é criado direto no Microsoft Graph porque o nó pronto do Outlook, no n8n Cloud, não enviava o conteúdo do arquivo corretamente.

**Teams: liberdade para escrever, mas só quando o dono pede.** A Kira lê e envia mensagens em nome do dono, sem rascunho, porque foi o que ele pediu. Para isso não virar risco, ela só envia com um pedido dele na conversa, trata o conteúdo do Teams como informação (nunca como ordem) e não repassa dados da empresa porque alguém pediu no chat.

**Pedidos pela base oficial, lida em etapas e guardada compacta.** A planilha oficial de pedidos (todas as unidades) passa de 250 MB: o Excel Online não abre, e baixar e ler tudo a cada pergunta levaria minutos. Por isso a leitura pesada fica num workflow agendado, que roda só quando a planilha muda e guarda no OneDrive uma base compacta (itens dos últimos 120 dias, todos os em aberto e os totais mensais por unidade). A ferramenta da Kira só baixa essa base e filtra (poucos segundos) e manda ao Gemini só as linhas e colunas da pergunta, com a hora da planilha para ela citar. Tudo com a mesma credencial do Teams e sem serviço pago: a descompressão é JavaScript puro dentro do nó Code, e o limite de 60 segundos por nó é contornado com voltas de ~35 segundos que passam o estado adiante.

**Planilha do negócio lida na hora, só no modo Negócios.** A planilha do negócio tem menos de 1 MB, então a ferramenta baixa e lê o arquivo a cada consulta (poucos segundos) e a Kira sempre vê a versão mais recente que você salvou no Drive, sem sincronização. A leitura reaproveita o descompressor em JavaScript puro da base de pedidos; as abas são achadas pelo nome e as colunas pelo cabeçalho, e os números vêm do valor que o Excel gravou ao salvar (inclusive os cartões dos painéis, já com R$ e %). A simulação de preço refaz no código as fórmulas da precificação, para a IA não fazer conta de cabeça. A trava do ambiente fica no sub-workflow e o ambiente vem do workflow da Kira, então nem uma instrução confusa faz a planilha aparecer em outro ambiente; as execuções que dão certo não ficam no histórico, porque levam dados de clientes.

**Power BI pela API oficial, com DAX escrito pela Kira.** Os relatórios do Power BI já juntam os dados do ERP com as regras da empresa (medidas prontas). Em vez de exportar arquivos, a ferramenta consulta o modelo semântico direto (`executeQueries`, só leitura) com a conta conectada: a Kira vê a estrutura do modelo, escreve a consulta DAX e recebe só as linhas agregadas de que precisa, com a hora da última atualização. O preço é a permissão: a API exige a permissão de criar conteúdo (Build) no modelo, que o dono dá; sem ela, a Kira explica o que falta em vez de inventar.

**Assinatura nos rascunhos por um sub-workflow.** A assinatura do Outlook não entra em rascunhos criados pela API. O sub-workflow monta o texto com a imagem (anexo *inline*, referenciado por `cid`) e o e-mail do dono, e é o mesmo para os rascunhos que você pede e para os automáticos. A imagem fica no Google Drive e é achada pelo nome (vale a mais recente), para você trocar sem mexer no n8n.

**Ambientes separados (Kira 2.0).** O ambiente ativo fica em `kira_config` e só muda por uma mensagem curta de troca ("modo pessoal"), reconhecida por código, sem IA: assim a troca é previsível e barata. A IA é instruída a nunca dizer que trocou de ambiente; se você pedir a troca no meio de outra frase, ela pede o comando curto. A separação vale em várias camadas: a memória da conversa usa uma chave por ambiente, as memórias de longo prazo são filtradas antes de chegar à IA, e as ferramentas de tarefas, contatos e conversas filtram por usuário e ambiente com valores que vêm do workflow, nunca da IA. As instruções completam o resto: a Kira não usa dados de outro ambiente sem autorização na mesma mensagem. A lista de ambientes fica num nó próprio (**Ambientes da Kira**), separado da configuração geral.

**Histórico quebrado se conserta sozinho.** A memória da conversa guarda também as chamadas de ferramenta e manda para o Gemini só as últimas 20 interações. Quando uma resposta usa duas ferramentas ao mesmo tempo, o corte pode passar a cair no meio de uma chamada, e o Gemini recusa o pedido ("function call turn…"). Como a mensagem que falha não entra no histórico, todas as seguintes falhariam do mesmo jeito. Na primeira falha desse tipo, a Kira reinicia o histórico com um resumo das últimas trocas (da tabela `kira_logs`, do mesmo chat e ambiente) e repete a pergunta, então você recebe a resposta sem perceber.

**Rascunhos automáticos, nunca envio.** Um workflow agendado, separado da Kira, prepara respostas para e-mails sobre pedidos. Um filtro por palavras evita chamar a IA para e-mails que não interessam; a IA decide se responde, consulta a base de pedidos e escreve; o Outlook só recebe um rascunho (`createReply`, com a assinatura). O e-mail é tratado como texto de terceiros (a Kira ignora instruções dentro dele), remetentes de fora recebem só dados dos pedidos que citaram e, quando o pedido não está na base, a resposta não afirma que ele não existe.

**Internet pela Busca Google do próprio Gemini.** Em vez de outro serviço de busca (que pediria outra conta e outra chave), a ferramenta usa o *grounding* com a Busca Google do Gemini, com a mesma chave gratuita: o modelo pesquisa, lê os resultados e responde com as fontes. Fica num sub-workflow para a Kira receber só a resposta e as fontes, já limpas, e para trocar de modelo sem mexer na Kira. As perguntas vão para o Google; por isso as instruções proíbem colocar nelas dados internos da empresa ou dados pessoais.

**Resumo da manhã em workflow separado.** Às 7h, RSS de fontes confiáveis + cotações + Gemini + Telegram. Fica separado da Kira para que uma falha num não afete o outro. O Gemini recebe só a lista de notícias do dia e é instruído a não usar nada de fora dela; se ele falhar, vão os títulos com link. Depois do texto, um segundo pedido ao Gemini transforma o resumo num roteiro curto de rádio e a voz do Gemini o lê (o mesmo caminho de áudio da Kira). As buscas do Google Notícias passam por uma lista de veículos confiáveis.

**Áudio como "arquivo de áudio", não como "mensagem de voz".** O nó do Telegram no n8n não tem a operação de mensagem de voz (*sendVoice*). Chamar a API do Telegram direto exigiria colocar o token do bot dentro do workflow, o que é inseguro. Por isso a resposta sai como áudio tocável (título "Kira") com o texto na legenda.

**Duas memórias.**
- *Curto prazo* (**Memória da conversa**): as últimas 20 trocas, guardadas na memória do n8n. É rápida, mas se perde quando o n8n reinicia.
- *Longo prazo* (`kira_memoria`): fatos que você pede para guardar. A própria Kira grava e apaga pelas ferramentas; o `user_id` vem do Telegram, nunca da IA, então ela não consegue gravar ou apagar memórias de outra pessoa.
- O `/limpar` usa um segundo nó de memória com a **mesma Session Key** (`kira-<chat_id>`). No n8n, nós de memória simples com a mesma chave compartilham o mesmo histórico, e é isso que permite apagá-lo pelo nó *Limpar histórico da conversa*.

**Modelo de reserva.** A conversa usa um modelo principal e um de reserva. Se o principal ficar indisponível ou atingir o limite do plano gratuito, o agente usa a reserva sem você perceber.

**Formatação segura.** O Gemini escreve em Markdown; o Telegram aceita um HTML restrito. O nó *Dividir mensagem* converte (negrito, itálico, listas, código, links), escapa `<`, `>` e `&` e divide textos longos. Se ainda assim o Telegram recusar, a mensagem vai sem formatação.

**A Kira nunca fica muda.** Falhas na transcrição, na IA ou na voz caem em respostas de reserva ("não consegui processar o seu áudio", "atingi o limite", texto no lugar do áudio) e ficam registradas em `kira_logs`.

**Segurança.**
- Só IDs listados em `ids_autorizados`, e só no chat privado.
- Tokens e chaves ficam nas credenciais do n8n; o workflow e este repositório não têm segredos (`npm test` verifica).
- O workflow versionado não inclui o caminho do webhook.
- Este repositório é público: o nome e o perfil pessoal (`nome_dono`, `perfil_dono`) e as credenciais ficam só no n8n.

## Limitações conhecidas da 1.0

- A voz chega como arquivo de áudio, não como mensagem de voz com a onda sonora.
- A memória da conversa se perde quando o n8n reinicia (as memórias guardadas não).
- E-mail e agenda só do Outlook: a Kira lê e prepara rascunhos, mas não envia. No Teams, ela só escreve em conversas que já existem. Dos dados da empresa, só a base oficial de pedidos (itens dos últimos 120 dias, os em aberto e os totais mensais); os demais arquivos do OneDrive ainda não. A Kira foi instruída a dizer isso em vez de inventar.
- A planilha do negócio mostra os números da última vez que foi atualizada e salva no Drive; as vendas são o total do período do relatório (não por mês).
- O Google Drive é só leitura, e PDFs, Word e imagens do Drive ainda não são lidos.
- As imagens e as pesquisas na internet dependem das cotas gratuitas diárias do Gemini.
- O ambiente ativo vale para você em todos os chats e só muda por mensagem ("modo <nome>").
- Os rascunhos automáticos rodam de segunda a sexta, das 7h às 19h30, até 5 e-mails por rodada, e só usam a base de pedidos.
- A base de pedidos é atualizada de segunda a sábado, às 9h, 12h, 15h e 18h: entre uma leitura e outra, a Kira responde com a versão anterior (e cita a hora dela).
- O resumo das 7h é enviado por outro workflow: a Kira da conversa não "lembra" dele.
- Documentos (PDF, Word), vídeos e figurinhas ainda não são entendidos. As fotos passam pelo leitor de imagens: a Kira responde com base na descrição dele, não olhando a foto ela mesma.
- Mensagens enviadas em sequência muito rápida são processadas em paralelo e podem ser respondidas fora de ordem.

## Próximos passos

1. **Mais dados de Negócios e Pessoal**: leads e CRM, o segundo negócio e finanças, cada um no seu ambiente e com permissões mínimas.
2. **Memória persistente da conversa** (por exemplo, *Postgres Chat Memory*), para não perder o contexto em reinícios.
3. **Kira proativa**: o fim do dia já traz a agenda do próximo dia útil e as tarefas do trabalho; falta juntar ao resumo das 7h a agenda do dia e as tarefas abertas de cada ambiente.
4. **Documentos (PDF e Word) e vídeos**, como já acontece com as fotos.
5. **Privacidade**: e-mails, Teams, pedidos e a planilha do negócio já passam pelo Gemini no plano gratuito, por escolha do dono; o plano pago evita que o Google use esse conteúdo. Este repositório deve ficar privado se passar a guardar qualquer coisa sensível.
