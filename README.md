# KIRA

Meu bot particular: a **Kira** é uma assistente pessoal de IA que roda no **n8n**, pensa com o **Google Gemini** e conversa comigo pelo **Telegram**, por texto ou por voz.

> **Status: no ar, já com os ambientes da Kira 2.0** (Trabalho, Negócios e Pessoal, cada um com memórias, tarefas e contatos separados), grátis (chave gratuita do Gemini): Outlook (leitura e rascunhos de resposta com a sua assinatura), Google Drive (leitura), Microsoft Teams (lê e responde quando você pede), pedidos da empresa (base oficial do ERP, atualizada 4 vezes ao dia), a planilha do negócio no modo Negócios (vendas, vendedoras, clientes, estoque e precificação), pesquisa na internet (Busca Google), rascunhos de posts do LinkedIn, imagens com IA, resumo de notícias às 7h em texto e áudio e rascunhos automáticos para e-mails que perguntam de pedidos. Para montar do zero, siga o [guia de configuração](docs/configuracao.md).

## Como funciona

```
🎙️ / 💬  Você manda uma mensagem no Telegram
              │
              ▼
   n8n: confere se é você ─► é comando? áudio? texto?
              │                      │
              │        áudio: baixa e transcreve (Gemini)
              ▼                      ▼
   KIRA (agente de IA · Gemini)  ◄── memória da conversa + memórias guardadas
              │                  ◄── Outlook: e-mails e agenda (leitura) + rascunhos de resposta
              │                  ◄── Google Drive (leitura)
              │                  ◄── LinkedIn: rascunhos (publica só com /publicar)
              │                  ◄── imagens com IA (Gemini) ─► Telegram
              │                  ◄── Teams: lê e responde quando você pede
              │                  ◄── pedidos: base compacta no OneDrive (gerada da planilha oficial do ERP)
              │                  ◄── modo Negócios: planilha do negócio no Google Drive (lida na hora)
              │
              ▼
   resposta falada (voz do Gemini) ou escrita ─► Telegram ─► registro em kira_logs

   ☀️ 7h: notícias (RSS) + cotações ─► resumo do Gemini ─► Telegram (texto + áudio da Kira)
   📦 seg a sáb, 9h/12h/15h/18h: planilha oficial de pedidos (SharePoint, centenas de MB) ─► lida em etapas ─► base compacta no OneDrive
```

## O que a Kira 1.0 faz

| Recurso | Como funciona |
| --- | --- |
| 💬 Texto | Você escreve, ela responde por escrito, com formatação leve. |
| 🎙️ Voz | Você manda um áudio, ela transcreve com o Gemini e responde com um áudio (voz do próprio Gemini, grátis) com o texto na legenda. |
| 🧠 Memória | Lembra as últimas 20 trocas da conversa e guarda fatos duradouros quando você pede ("Kira, lembre que…"). Também esquece quando você pede. |
| 🔒 Identificação | Só conversa com os IDs do Telegram liberados, e só no chat privado. |
| ✨ Personalidade | Calorosa, direta e honesta: não inventa dados que ainda não tem. Veja [persona-kira.md](docs/persona-kira.md). |
| 🗂️ Ambientes | Trabalho, Negócios e Pessoal: cada um com suas memórias, histórico, tarefas e contatos. Você troca com "modo pessoal" (ou `/pessoal`), e ela não mistura informações entre ambientes sem você autorizar. |
| ✅ Tarefas e contatos | Anota pendências e contatos no ambiente ativo, lista, conclui e procura; também procura conversas antigas ("o que combinamos com aquele cliente?"). |
| ⌨️ Comandos | `/start`, `/ajuda`, `/status`, `/memorias`, `/limpar`, `/id`, `/publicar N` e `modo <ambiente>` |
| 📋 Logs | Cada mensagem vira uma linha na tabela `kira_logs` do n8n. |
| 📬 Outlook | Lê e-mails e agenda quando você pergunta e prepara **rascunhos** de resposta, já com a sua assinatura (imagem e e-mail) e, se você quiser, com imagem anexa. Nunca envia, apaga ou altera nada: você revisa e envia. |
| 📁 Google Drive | Procura e lê Documentos, Planilhas e Apresentações do Google e arquivos de texto. Só leitura. |
| 💼 LinkedIn | Escreve o post e guarda como rascunho numerado, com ou sem imagem. Só vai para o LinkedIn quando você manda `/publicar N`. |
| 🖼️ Imagens | Gera imagens com o Gemini ("Nano Banana") quando você pede, manda no Telegram e numera (#1, #2…) para usar no LinkedIn ou em e-mails. |
| 💬 Teams | Lista e lê suas conversas do Microsoft Teams e escreve ou responde em seu nome **quando você pede** ("responde o João que o pedido sai amanhã"). |
| 📦 Pedidos | Consulta a base oficial de pedidos do ERP, de todas as unidades (pedido, cliente, material, valores, prazos, atraso, NF, compras, solicitações, produção), com os itens dos últimos 120 dias, todos os em aberto e os totais por mês e unidade. Responde citando a fonte e a hora da planilha. |
| 💎 Planilha do negócio | No modo **Negócios**, lê a planilha do negócio no Google Drive (.xlsx com as bases do sistema de vendas, a precificação e os painéis): resumo dos painéis, vendas por categoria e produto, vendedoras e acertos do consignado, clientes em atraso e para reativar, estoque por local, reposição e simulação de preço. Fora do modo Negócios, recusa. |
| 📊 Power BI | No modo **Trabalho**, consulta o Power BI da empresa pela API oficial, só leitura: lista os modelos e relatórios, vê as tabelas e medidas e roda consultas DAX para trazer totais, indicadores e comparações, citando a hora da última atualização. |
| 🌐 Internet | Pesquisa no Google quando a resposta depende de informação atualizada (notícias, cotações, preços, clima, leis, empresas) e lê a página quando você manda um link. Responde com a data da informação e as fontes. |
| 📝 Rascunhos automáticos | De segunda a sexta, a cada 30 minutos, olha os e-mails novos, separa os que perguntam de pedidos, consulta a base de pedidos e deixa a resposta como **rascunho** no Outlook, com a sua assinatura (nunca envia). Depois avisa no Telegram. |
| ☀️ Resumo da manhã | Todo dia às 7h: Brasil, Mundo, Mercado financeiro, Mineração/petróleo/siderurgia/florestal, Política e Tecnologia, com links das fontes, cotações do dia e **áudio na voz da Kira**. |

## Estrutura do repositório

| Caminho | Conteúdo |
| --- | --- |
| [`n8n/workflows/kira-1.0.json`](n8n/workflows/kira-1.0.json) | O workflow da Kira para importar no n8n |
| [`n8n/sdk/kira-1.0.workflow.ts`](n8n/sdk/kira-1.0.workflow.ts) | A mesma definição no formato do n8n Workflow SDK, para recriar ou evoluir o workflow com IA (MCP do n8n) |
| [`n8n/workflows/kira-resumo-da-manha.json`](n8n/workflows/kira-resumo-da-manha.json) | Workflow do resumo de notícias das 7h (e o SDK em [`n8n/sdk/kira-resumo-da-manha.workflow.ts`](n8n/sdk/kira-resumo-da-manha.workflow.ts)) |
| [`n8n/workflows/kira-gerar-imagem.json`](n8n/workflows/kira-gerar-imagem.json) | Sub-workflow da ferramenta `gerar_imagem` (e o SDK em [`n8n/sdk/kira-gerar-imagem.workflow.ts`](n8n/sdk/kira-gerar-imagem.workflow.ts)) |
| [`n8n/workflows/kira-anexar-imagem.json`](n8n/workflows/kira-anexar-imagem.json) | Sub-workflow da ferramenta `anexar_imagem_email` (e o SDK em [`n8n/sdk/kira-anexar-imagem.workflow.ts`](n8n/sdk/kira-anexar-imagem.workflow.ts)) |
| [`n8n/workflows/kira-teams.json`](n8n/workflows/kira-teams.json) | Sub-workflow das ferramentas do Teams (e o SDK em [`n8n/sdk/kira-teams.workflow.ts`](n8n/sdk/kira-teams.workflow.ts)) |
| [`n8n/workflows/kira-pedidos.json`](n8n/workflows/kira-pedidos.json) | Sub-workflow da ferramenta `consultar_pedidos` (e o SDK em [`n8n/sdk/kira-pedidos.workflow.ts`](n8n/sdk/kira-pedidos.workflow.ts)) |
| [`n8n/workflows/kira-base-de-pedidos.json`](n8n/workflows/kira-base-de-pedidos.json) | Sincronização que lê a planilha oficial de pedidos em etapas e grava a base compacta no OneDrive (e o SDK em [`n8n/sdk/kira-base-de-pedidos.workflow.ts`](n8n/sdk/kira-base-de-pedidos.workflow.ts)) |
| [`n8n/workflows/kira-rascunho-resposta.json`](n8n/workflows/kira-rascunho-resposta.json) | Sub-workflow que cria o rascunho de resposta com a assinatura (imagem e e-mail), usado pela Kira e pelos rascunhos automáticos (e o SDK em [`n8n/sdk/kira-rascunho-resposta.workflow.ts`](n8n/sdk/kira-rascunho-resposta.workflow.ts)) |
| [`n8n/workflows/kira-pesquisar-internet.json`](n8n/workflows/kira-pesquisar-internet.json) | Sub-workflow da ferramenta `pesquisar_internet` (e o SDK em [`n8n/sdk/kira-pesquisar-internet.workflow.ts`](n8n/sdk/kira-pesquisar-internet.workflow.ts)) |
| [`n8n/workflows/kira-planilha-negocio.json`](n8n/workflows/kira-planilha-negocio.json) | Sub-workflow da ferramenta `consultar_negocio`, que lê a planilha do negócio no Google Drive (e o SDK em [`n8n/sdk/kira-planilha-negocio.workflow.ts`](n8n/sdk/kira-planilha-negocio.workflow.ts)) |
| [`n8n/workflows/kira-powerbi.json`](n8n/workflows/kira-powerbi.json) | Sub-workflow da ferramenta `consultar_powerbi`, que consulta o Power BI pela API oficial (e o SDK em [`n8n/sdk/kira-powerbi.workflow.ts`](n8n/sdk/kira-powerbi.workflow.ts)) |
| [`n8n/workflows/kira-rascunhos-automaticos.json`](n8n/workflows/kira-rascunhos-automaticos.json) | Workflow dos rascunhos automáticos de e-mails sobre pedidos (e o SDK em [`n8n/sdk/kira-rascunhos-automaticos.workflow.ts`](n8n/sdk/kira-rascunhos-automaticos.workflow.ts)) |
| [`docs/configuracao.md`](docs/configuracao.md) | Passo a passo para ativar, primeiro teste e solução de problemas |
| [`docs/arquitetura.md`](docs/arquitetura.md) | Como tudo se encaixa, decisões técnicas e próximos passos |
| [`docs/persona-kira.md`](docs/persona-kira.md) | Personalidade e instruções da Kira |
| [`scripts/testar-codigo.mjs`](scripts/testar-codigo.mjs) | Testes do código do workflow |

## Testes

Com Node.js 18 ou mais recente:

```bash
npm test
```

Os testes executam o código dos nós dos workflows (formatação para o Telegram, voz e texto, áudio WAV, comandos, ambientes e troca de ambiente, memórias por ambiente, `/publicar` com e sem imagem, geração e anexo de imagens, Teams, leitura da planilha de pedidos em etapas (um .xlsx gerado no próprio teste), base compacta e consulta de pedidos, planilha do negócio (outro .xlsx gerado no teste, com painéis, bases e precificação), rascunho com assinatura, pesquisa na internet, rascunhos automáticos, resumo da manhã com cotações, fontes confiáveis e áudio), conferem que Outlook e Drive só leem (o Outlook só cria rascunhos) e verificam que nenhum token, chave de API ou caminho de webhook foi parar nos arquivos.

## Segurança

- Tokens e chaves de API ficam **só nas credenciais do n8n**. Nunca no chat, no código ou neste repositório.
- Este repositório é **público**: o perfil pessoal da Kira, os IDs do Telegram e do LinkedIn e os IDs dos sub-workflows ficam preenchidos apenas no n8n.
- Nada sai em seu nome sem você: e-mails ficam como rascunho (inclusive os automáticos), posts só vão para o LinkedIn com `/publicar N` e mensagens no Teams só saem quando você pede.
- Os ambientes não se misturam: memórias, histórico, tarefas e contatos de um ambiente não aparecem em outro sem você autorizar. A planilha do negócio só é lida no modo Negócios e o Power BI só no modo Trabalho (a trava fica no sub-workflow, com o ambiente vindo do workflow, não da IA).

## Roadmap

- **Kira 1.0**: Telegram + Gemini, texto e voz, memória, comandos e logs; Outlook (leitura e rascunhos), Google Drive (leitura), Teams (lê e responde quando você pede), pedidos da empresa, LinkedIn (rascunhos e `/publicar`), imagens com IA e resumo das 7h em texto e áudio.
- **Kira 2.0** (agora): ambientes **Trabalho**, **Negócios** e **Pessoal**, com memórias, histórico, tarefas e contatos separados, rascunhos automáticos para e-mails sobre pedidos, pesquisa na internet, a base oficial de pedidos (todas as unidades), a assinatura nos rascunhos, a planilha do negócio no modo Negócios e o Power BI da empresa no modo Trabalho.
- **Próximos**: mais fontes de Negócios (leads e CRM) e de finanças, memória da conversa que sobrevive a reinícios e um resumo do dia com agenda e tarefas. Detalhes em [arquitetura.md](docs/arquitetura.md#próximos-passos).
