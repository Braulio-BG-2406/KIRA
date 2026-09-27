# KIRA

Meu bot particular: a **Kira** é uma assistente pessoal de IA que roda no **n8n**, pensa com o **Google Gemini** e conversa comigo pelo **Telegram**, por texto ou por voz.

> **Status: Kira 1.0 no ar**, grátis (chave gratuita do Gemini): Outlook (leitura e rascunhos de resposta), Google Drive (leitura), rascunhos de posts do LinkedIn, imagens com IA e resumo de notícias às 7h. Para montar do zero, siga o [guia de configuração](docs/configuracao.md).

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
              │
              ▼
   resposta falada (voz do Gemini) ou escrita ─► Telegram ─► registro em kira_logs

   ☀️ 7h: notícias (RSS) + cotações ─► resumo do Gemini ─► Telegram
```

## O que a Kira 1.0 faz

| Recurso | Como funciona |
| --- | --- |
| 💬 Texto | Você escreve, ela responde por escrito, com formatação leve. |
| 🎙️ Voz | Você manda um áudio, ela transcreve com o Gemini e responde com um áudio (voz do próprio Gemini, grátis) com o texto na legenda. |
| 🧠 Memória | Lembra as últimas 20 trocas da conversa e guarda fatos duradouros quando você pede ("Kira, lembre que…"). Também esquece quando você pede. |
| 🔒 Identificação | Só conversa com os IDs do Telegram liberados, e só no chat privado. |
| ✨ Personalidade | Calorosa, direta e honesta: não inventa dados que ainda não tem. Veja [persona-kira.md](docs/persona-kira.md). |
| ⌨️ Comandos | `/start`, `/ajuda`, `/status`, `/memorias`, `/limpar`, `/id`, `/publicar N` |
| 📋 Logs | Cada mensagem vira uma linha na tabela `kira_logs` do n8n. |
| 📬 Outlook | Lê e-mails e agenda quando você pergunta e prepara **rascunhos** de resposta (com imagem, se você quiser). Nunca envia, apaga ou altera nada: você revisa e envia. |
| 📁 Google Drive | Procura e lê Documentos, Planilhas e Apresentações do Google e arquivos de texto. Só leitura. |
| 💼 LinkedIn | Escreve o post e guarda como rascunho numerado, com ou sem imagem. Só vai para o LinkedIn quando você manda `/publicar N`. |
| 🖼️ Imagens | Gera imagens com o Gemini ("Nano Banana") quando você pede, manda no Telegram e numera (#1, #2…) para usar no LinkedIn ou em e-mails. |
| ☀️ Resumo da manhã | Todo dia às 7h: Brasil, Mundo, Mercado financeiro, Política e Tecnologia, com links das fontes. |

## Estrutura do repositório

| Caminho | Conteúdo |
| --- | --- |
| [`n8n/workflows/kira-1.0.json`](n8n/workflows/kira-1.0.json) | O workflow da Kira para importar no n8n |
| [`n8n/sdk/kira-1.0.workflow.ts`](n8n/sdk/kira-1.0.workflow.ts) | A mesma definição no formato do n8n Workflow SDK, para recriar ou evoluir o workflow com IA (MCP do n8n) |
| [`n8n/workflows/kira-resumo-da-manha.json`](n8n/workflows/kira-resumo-da-manha.json) | Workflow do resumo de notícias das 7h (e o SDK em [`n8n/sdk/kira-resumo-da-manha.workflow.ts`](n8n/sdk/kira-resumo-da-manha.workflow.ts)) |
| [`n8n/workflows/kira-gerar-imagem.json`](n8n/workflows/kira-gerar-imagem.json) | Sub-workflow da ferramenta `gerar_imagem` (e o SDK em [`n8n/sdk/kira-gerar-imagem.workflow.ts`](n8n/sdk/kira-gerar-imagem.workflow.ts)) |
| [`n8n/workflows/kira-anexar-imagem.json`](n8n/workflows/kira-anexar-imagem.json) | Sub-workflow da ferramenta `anexar_imagem_email` (e o SDK em [`n8n/sdk/kira-anexar-imagem.workflow.ts`](n8n/sdk/kira-anexar-imagem.workflow.ts)) |
| [`docs/configuracao.md`](docs/configuracao.md) | Passo a passo para ativar, primeiro teste e solução de problemas |
| [`docs/arquitetura.md`](docs/arquitetura.md) | Como tudo se encaixa, decisões técnicas e próximos passos |
| [`docs/persona-kira.md`](docs/persona-kira.md) | Personalidade e instruções da Kira |
| [`scripts/testar-codigo.mjs`](scripts/testar-codigo.mjs) | Testes do código do workflow |

## Testes

Com Node.js 18 ou mais recente:

```bash
npm test
```

Os testes executam o código dos nós dos workflows (formatação para o Telegram, voz e texto, áudio WAV, comandos, `/publicar` com e sem imagem, geração e anexo de imagens, resumo da manhã), conferem que Outlook e Drive só leem (o Outlook só cria rascunhos) e verificam que nenhum token, chave de API ou caminho de webhook foi parar nos arquivos.

## Segurança

- Tokens e chaves de API ficam **só nas credenciais do n8n**. Nunca no chat, no código ou neste repositório.
- Este repositório é **público**: o perfil pessoal da Kira, os IDs do Telegram e do LinkedIn e os IDs dos sub-workflows ficam preenchidos apenas no n8n.
- Nada sai em seu nome sem você: e-mails ficam como rascunho e posts só vão para o LinkedIn com `/publicar N`.

## Roadmap

- **Kira 1.0** (agora): Telegram + Gemini, texto e voz, memória, comandos e logs; Outlook (leitura e rascunhos), Google Drive (leitura), LinkedIn (rascunhos e `/publicar`), imagens com IA e resumo das 7h.
- **Kira 2.0**: conectar as áreas **HM** (Microsoft 365: OneDrive, Outlook, documentos e e-mails), **Negócios** (clientes, vendas, estoque, CRM) e **Pessoal** (agenda, estudos, rotina, notícias, finanças). Detalhes em [arquitetura.md](docs/arquitetura.md#próximos-passos-kira-20).
