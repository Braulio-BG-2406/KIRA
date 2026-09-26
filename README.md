# KIRA

Meu bot particular: a **Kira** é uma assistente pessoal de IA que roda no **n8n**, pensa com o **Google Gemini** e conversa comigo pelo **Telegram**, por texto ou por voz.

> **Status: Kira 1.0 pronta para ativar.** O workflow já está criado no n8n e testado. Faltam as credenciais do Google e o seu ID do Telegram: siga o [guia de configuração](docs/configuracao.md).

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
              │
              ▼
   resposta falada (Google TTS) ou escrita ─► Telegram ─► registro em kira_logs
```

## O que a Kira 1.0 faz

| Recurso | Como funciona |
| --- | --- |
| 💬 Texto | Você escreve, ela responde por escrito, com formatação leve. |
| 🎙️ Voz | Você manda um áudio, ela transcreve com o Gemini e responde com um áudio (Google Text-to-Speech) com o texto na legenda. |
| 🧠 Memória | Lembra as últimas 20 trocas da conversa e guarda fatos duradouros quando você pede ("Kira, lembre que…"). Também esquece quando você pede. |
| 🔒 Identificação | Só conversa com os IDs do Telegram liberados, e só no chat privado. |
| ✨ Personalidade | Calorosa, direta e honesta: não inventa dados que ainda não tem. Veja [persona-kira.md](docs/persona-kira.md). |
| ⌨️ Comandos | `/start`, `/ajuda`, `/status`, `/memorias`, `/limpar`, `/id` |
| 📋 Logs | Cada mensagem vira uma linha na tabela `kira_logs` do n8n. |

## Estrutura do repositório

| Caminho | Conteúdo |
| --- | --- |
| [`n8n/workflows/kira-1.0.json`](n8n/workflows/kira-1.0.json) | O workflow da Kira para importar no n8n |
| [`n8n/sdk/kira-1.0.workflow.ts`](n8n/sdk/kira-1.0.workflow.ts) | A mesma definição no formato do n8n Workflow SDK, para recriar ou evoluir o workflow com IA (MCP do n8n) |
| [`docs/configuracao.md`](docs/configuracao.md) | Passo a passo para ativar, primeiro teste e solução de problemas |
| [`docs/arquitetura.md`](docs/arquitetura.md) | Como tudo se encaixa, decisões técnicas e próximos passos |
| [`docs/persona-kira.md`](docs/persona-kira.md) | Personalidade e instruções da Kira |
| [`scripts/testar-codigo.mjs`](scripts/testar-codigo.mjs) | Testes do código do workflow |

## Testes

Com Node.js 18 ou mais recente:

```bash
npm test
```

Os testes executam o código dos nós do workflow (formatação para o Telegram, escolha entre voz e texto, comandos) e verificam que nenhum token, chave de API ou caminho de webhook foi parar nos arquivos.

## Segurança

- Tokens e chaves de API ficam **só nas credenciais do n8n**. Nunca no chat, no código ou neste repositório.
- Este repositório é **público**: o perfil pessoal da Kira fica preenchido apenas no n8n.

## Roadmap

- **Kira 1.0** (agora): Telegram + Gemini, texto e voz, memória, comandos e logs.
- **Kira 2.0**: conectar as áreas **HM** (Microsoft 365: OneDrive, Outlook, documentos e e-mails), **Negócios** (clientes, vendas, estoque, CRM) e **Pessoal** (agenda, estudos, rotina, notícias, finanças). Detalhes em [arquitetura.md](docs/arquitetura.md#próximos-passos-kira-20).
