# KIRA

Meu bot particular: a **Kira** é uma assistente pessoal de IA que roda no **n8n**, pensa com o **Google Gemini** e conversa comigo pelo **Telegram**, por texto ou por voz.

> **Status: Kira 1.0 no ar**, grátis (chave gratuita do Gemini), com leitura do Outlook e resumo de notícias às 7h. Para montar do zero, siga o [guia de configuração](docs/configuracao.md).

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
              │                  ◄── Outlook: e-mails e agenda (só leitura)
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
| ⌨️ Comandos | `/start`, `/ajuda`, `/status`, `/memorias`, `/limpar`, `/id` |
| 📋 Logs | Cada mensagem vira uma linha na tabela `kira_logs` do n8n. |
| 📬 Outlook | Lê e-mails e agenda do Outlook quando você pergunta. Só leitura: não envia, não apaga, não altera. |
| ☀️ Resumo da manhã | Todo dia às 7h: Brasil, Mundo, Mercado financeiro, Política e Tecnologia, com links das fontes. |

## Estrutura do repositório

| Caminho | Conteúdo |
| --- | --- |
| [`n8n/workflows/kira-1.0.json`](n8n/workflows/kira-1.0.json) | O workflow da Kira para importar no n8n |
| [`n8n/sdk/kira-1.0.workflow.ts`](n8n/sdk/kira-1.0.workflow.ts) | A mesma definição no formato do n8n Workflow SDK, para recriar ou evoluir o workflow com IA (MCP do n8n) |
| [`n8n/workflows/kira-resumo-da-manha.json`](n8n/workflows/kira-resumo-da-manha.json) | Workflow do resumo de notícias das 7h (e o SDK em [`n8n/sdk/kira-resumo-da-manha.workflow.ts`](n8n/sdk/kira-resumo-da-manha.workflow.ts)) |
| [`docs/configuracao.md`](docs/configuracao.md) | Passo a passo para ativar, primeiro teste e solução de problemas |
| [`docs/arquitetura.md`](docs/arquitetura.md) | Como tudo se encaixa, decisões técnicas e próximos passos |
| [`docs/persona-kira.md`](docs/persona-kira.md) | Personalidade e instruções da Kira |
| [`scripts/testar-codigo.mjs`](scripts/testar-codigo.mjs) | Testes do código do workflow |

## Testes

Com Node.js 18 ou mais recente:

```bash
npm test
```

Os testes executam o código dos nós dos workflows (formatação para o Telegram, voz e texto, áudio WAV, comandos, resumo da manhã) e verificam que nenhum token, chave de API ou caminho de webhook foi parar nos arquivos.

## Segurança

- Tokens e chaves de API ficam **só nas credenciais do n8n**. Nunca no chat, no código ou neste repositório.
- Este repositório é **público**: o perfil pessoal da Kira fica preenchido apenas no n8n.

## Roadmap

- **Kira 1.0** (agora): Telegram + Gemini, texto e voz, memória, comandos e logs; Outlook (leitura) e resumo das 7h.
- **Kira 2.0**: conectar as áreas **HM** (Microsoft 365: OneDrive, Outlook, documentos e e-mails), **Negócios** (clientes, vendas, estoque, CRM) e **Pessoal** (agenda, estudos, rotina, notícias, finanças). Detalhes em [arquitetura.md](docs/arquitetura.md#próximos-passos-kira-20).
