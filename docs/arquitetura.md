# Arquitetura da Kira

## Visão geral

A Kira é um **agente central** que roda no n8n. A versão 1.0 cuida só da conversa (texto e voz pelo Telegram); a 2.0 conecta as áreas da vida e do trabalho.

```
                    ┌──────────────────────────┐
                    │           n8n            │
                    │   KIRA · agente central  │
                    │     (Google Gemini)      │
                    └────────────┬─────────────┘
                                 │
           ┌─────────────────────┼─────────────────────┐
           │                     │                     │
       🏢 HM               💼 NEGÓCIOS            👤 PESSOAL
   Microsoft 365          clientes, vendas       agenda, estudos,
   OneDrive, Outlook      estoque, CRM           rotina, notícias,
   documentos, e-mails                           finanças
           │                     │                     │
           └──────────── Kira 2.0 (próxima) ───────────┘

   Kira 1.0 (agora):   📱 Telegram ──► n8n ──► Gemini ──► Kira ──► 📱 Telegram
                        🎙️ voz ou 💬 texto                    🔊 voz ou 💬 texto
```

## Caminho de uma mensagem

Os nomes em **negrito** são os nós do workflow [`n8n/workflows/kira-1.0.json`](../n8n/workflows/kira-1.0.json).

1. **Telegram Trigger** recebe a mensagem (webhook do bot).
2. **Configuração da Kira** acrescenta as configurações (nome, IDs liberados, modo de voz, voz, fuso, perfil).
3. **Normalizar entrada** extrai chat, usuário, texto e tipo (`comando`, `voz`, `texto` ou `outro`), confere se o usuário está liberado e decide se a resposta vai por voz.
4. **É você?** — quem não está em `ids_autorizados` (ou escreve fora do chat privado) recebe **Resposta: acesso negado**. Com a lista vazia, essa resposta mostra o ID da pessoa (modo de configuração).
5. **Mostrar "digitando…"** mostra *digitando* ou *gravando voz* no Telegram.
6. **Tipo de mensagem** separa o caminho:
   - **Comando** → **É /limpar?** → (**Limpar histórico da conversa**) → **Buscar memórias (comandos)** → **Resposta do comando**.
   - **Voz** → **Baixar áudio** → **Transcrever áudio (Gemini)**.
   - **Texto** → segue direto.
   - **Outro** (foto, documento, figurinha…) → **Resposta: tipo não suportado**.
7. **Pergunta** → **Buscar memórias** → **Agregar memórias** → **Contexto da conversa** montam o que a Kira precisa: a pergunta, a data e hora, o perfil e as memórias guardadas.
8. **Kira** (AI Agent) responde usando:
   - **Gemini (principal)** e **Gemini (reserva)**: se o principal falhar, a reserva assume;
   - **Memória da conversa**: as últimas 20 trocas;
   - ferramentas **salvar_memoria** e **apagar_memoria** (tabela `kira_memoria`).
9. **Resposta da Kira** (ou **Resposta de erro**, se a transcrição ou a IA falharem) padroniza a resposta.
10. **Resposta pronta** decide voz ou texto e prepara o texto falado e a legenda.
    - Voz: **Gerar voz (Google TTS)** → **Áudio para arquivo** → **Enviar áudio**.
    - Texto: **Dividir mensagem** (Markdown → HTML do Telegram, em partes de até 3.500 caracteres) → **Enviar texto** (→ **Enviar texto sem formatação**, se o Telegram recusar a formatação).
    - Se a voz falhar, a resposta vai por texto.
11. **Registrar conversa** grava tudo em `kira_logs`.

## Dados

| Tabela | Colunas | Para que serve |
| --- | --- | --- |
| `kira_memoria` | `user_id`, `categoria` (`pessoal`, `negocios`, `hm`, `geral`), `fato` | Memórias de longo prazo. A Kira lê as 100 mais recentes a cada mensagem |
| `kira_logs` | `chat_id`, `user_id`, `usuario`, `tipo_entrada`, `entrada`, `resposta`, `modo_resposta`, `entregue_como`, `status`, `erro`, `latencia_ms`, `execucao_id` | Histórico e diagnóstico de cada mensagem |

As duas tabelas também têm `id`, `createdAt` e `updatedAt`, criados pelo n8n.

## Decisões e porquês

**Transcrição com o Gemini.** O mesmo Gemini que conversa também entende áudio. O nó usa a operação *Analyze audio* com uma instrução em português ("transcreva literalmente…; se não houver fala, responda [inaudível]"), o que dá uma transcrição limpa, sem rótulos.

**Voz com Google Cloud Text-to-Speech, em MP3.** O Gemini também gera voz, mas entrega áudio cru (PCM) que o Telegram não toca, e o n8n não tem conversor de áudio embutido. O Cloud TTS entrega MP3 pronto, com vozes naturais em português.

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
- Este repositório é público: o perfil pessoal (`perfil_dono`) fica preenchido só no n8n.

## Limitações conhecidas da 1.0

- A voz chega como arquivo de áudio, não como mensagem de voz com a onda sonora.
- A memória da conversa se perde quando o n8n reinicia (as memórias guardadas não).
- Ainda sem acesso a e-mail, agenda, arquivos, dados das empresas ou internet; a Kira foi instruída a dizer isso em vez de inventar.
- Fotos e documentos ainda não são entendidos.
- Mensagens enviadas em sequência muito rápida são processadas em paralelo e podem ser respondidas fora de ordem.

## Próximos passos (Kira 2.0)

1. **Uma área por vez**, começando pela que der mais retorno, cada uma como um sub-agente ou ferramenta da Kira com permissões mínimas:
   - **HM**: Microsoft 365 (Outlook e OneDrive têm nós prontos no n8n).
   - **Negócios**: clientes, vendas, estoque e CRM (fontes a definir).
   - **Pessoal**: agenda, estudos, rotina, notícias e finanças.
2. **Memória persistente da conversa** (por exemplo, *Postgres Chat Memory*), para não perder o contexto em reinícios.
3. **Kira proativa**: um resumo de "bom dia" com agenda e pendências (gatilho agendado no n8n).
4. **Fotos e documentos**, aproveitando que o Gemini é multimodal.
5. **Privacidade**: plano pago do Gemini antes de conectar dados das empresas, e este repositório privado se ele passar a guardar qualquer coisa sensível.
