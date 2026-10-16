---
name: equipe-de-agentes
description: Organiza o trabalho em equipe entre o Claude (coordenador), subagentes que ele comanda e a Kira (assistente do usuário no n8n, com Telegram e Gemini) para projetos grandes - criar ou recriar sites, lojas, sistemas ERP, jogos e programas. Mostra como dividir o projeto em partes independentes, o que cada agente recebe e entrega, quando usar subagentes, sessões na nuvem, tarefas agendadas ou workflows da Kira, como a Kira usa os dados das lojas e roda rotinas como o Fim do Dia, e como cada problema resolvido vira melhoria nas skills (o modo de evolução). Use quando o usuário pedir mais agentes trabalhando, dividir ou acelerar um projeto grande, fazer a Kira participar, rodar uma rotina da Kira (Fim do Dia, Resumo da manhã, backup), criar um time ou um modo de evolução, recriar um sistema, site ou jogo inteiro, ou transformar o que foi feito em skill.
---

# Equipe de agentes: Claude, subagentes e Kira

A ideia do usuário desde o começo: a Kira com um "modo de evolução" e outros agentes,
comandados pelo Claude, para criar e recriar programas, sites, jogos e ERPs. Esta skill
diz quem faz o quê e como o time aprende.

## Quem é quem

| Agente | Onde roda | Bom para | Limites |
|---|---|---|---|
| **Claude (coordenador)** | a sessão atual | conversar com o usuário, planejar, dividir, revisar, integrar, testar, publicar | é quem responde por tudo o que os outros entregam |
| **Subagentes** (ferramenta Agent) | dentro da sessão, em paralelo | partes independentes: um tema, um módulo, a planilha do catálogo, os testes, uma pesquisa no código | não falam com o usuário; só sabem o que vem no prompt |
| **Workflow multiagente** (ferramenta Workflow) | dentro da sessão | muitos agentes com verificação cruzada | só quando o usuário pedir com essas palavras ("use um workflow", "ultracode"); gasta bastante do limite |
| **Sessões na nuvem** (`create_session`, `send_message`, `get_session`, `list_events`) | outra sessão do mesmo ambiente | tarefas longas e separadas, como uma loja nova enquanto outra é ajustada | não avisam quando terminam; acompanhe com `get_session` e `list_events` |
| **Tarefas agendadas** (`send_later`, `create_trigger`) | servidor | voltar a olhar algo mais tarde, rotinas | só vale a pena se houver algo que o Claude consiga conferir na volta |
| **Kira** (n8n na VPS + Telegram + Gemini) | VPS da Locaweb | conversar com o usuário no dia a dia, rotinas, avisos no Telegram, ler dados das lojas | não executa código nem comandos na VPS; muda só quando o Claude edita os workflows pelo conector do n8n |

## Como dividir um projeto

1. **Planeje por entregas, não por passos.** Por exemplo: "tema novo pronto e testado",
   "planilha da coleção pronta para importar", "comando de instalação testado".
2. **Separe o que é independente.** Cada agente mexe em arquivos diferentes. Se duas
   partes precisam do mesmo arquivo, ficam com o mesmo agente ou uma depois da outra.
3. **O prompt de cada agente leva:** objetivo; a skill a ler (caminho); os arquivos que
   ele pode mexer; como provar que terminou (comandos de teste); o que devolver (relatório
   curto: o que mudou, arquivos, resultado dos testes, dúvidas).
4. **Dispare juntos** os agentes independentes, na mesma mensagem (rodam em paralelo).
5. **Revise antes de aceitar.** O coordenador roda os testes, lê o que mudou e só então
   integra e faz o commit. "Pronto" de agente não é prova.
6. **Conte ao usuário** em português simples o que cada um fez e o que falta.

Exemplos:

- **"Cria uma loja para X":** agente 1 cadastro e tema (skill nova-loja); agente 2
  catálogo a partir das fotos e legendas, com as regras de coleção própria; agente 3
  testes. Depois o coordenador monta a prévia (previa-loja) e, com o "ok", publica
  (publicar-lojas-vps).
- **"Recria o sistema/site/jogo Y":** um agente estuda o comportamento (telas, regras,
  fluxos) a partir do uso e da documentação pública, sem descompilar nem copiar código,
  textos, imagens ou marcas; um agente desenha a arquitetura; agentes por módulo; um
  agente de testes. É engenharia reversa "de sala limpa": recria o que faz, não copia
  o que é.

## Onde a Kira entra

**Rotinas que já existem** no n8n da VPS (pegue a lista atual com `search_workflows`):

| Workflow | Id | Quando roda |
|---|---|---|
| Kira 2.0 — Assistente pessoal (Telegram + Gemini) | `ND2poMPpkXQKFb64` | sempre (conversa) |
| Kira — Resumo da manhã (7h) | `oxLHTN3LB4ut4Vq2` | todo dia às 7h |
| Kira — Fim do Dia (18h) | `rM9YsVy5Z10v5cvN` | seg a sex às 18h |
| Kira — Backup semanal (domingo 3h) | `SShrFforo7a97KZl` | domingo às 3h |
| Kira — Saúde (avisos e resumo de segunda) | `3jqPOSkAyEUZ5Ass` | quando algo falha; segunda às 8h |

**Rodar uma rotina quando o usuário pedir** (ex.: "roda o Fim do Dia"):
`get_workflow_details` com `detailLevel: "execution"` para conferir o gatilho e depois
`execute_workflow` com `executionMode: "production"` e sem `inputs` (gatilho de agenda).
O resultado chega no Telegram dele. Avise que a rotina também roda sozinha no horário
dela, então ele pode receber duas no dia.

**Conector do n8n (`n8n_VPS`).** É por ele que o Claude comanda a Kira: lê, cria e
edita workflows e roda os que têm gatilho de agenda, webhook, formulário ou chat (as
"ferramentas" da Kira, com gatilho de sub-workflow, não rodam direto). Para criar ou
editar, leia antes `get_workflow_sdk_reference` e `get_workflow_best_practices`, valide
com `validate_workflow` e só então crie ou atualize. Se o conector pedir login de novo ou
der tempo esgotado, diga ao usuário para reconectar o n8n nas configurações de
conectores do claude.ai; durante a montagem das lojas na VPS o n8n fica lento, e isso é
normal.

**Kira e lojas.** A API só de leitura das lojas responde perguntas como "quanto vendi
hoje?", "tem pedido para enviar?", "o que está acabando?" e monta posts:
`GET /api/kira/{resumo, pedidos, estoque-baixo, produtos, divulgar, clientes}` e
`POST /api/kira/manutencao` (a cada 15 min: cancela pedidos vencidos e sincroniza
Mercado Livre e Shopee), com `?loja=bg-imports` ou `?loja=infinite`. Dentro da VPS o
n8n alcança as lojas em `http://lojas:3000` (mesma rede Docker), sem passar pela
internet. O cabeçalho é `Authorization: Bearer <KIRA_API_TOKEN>`: o token está no `.env`
das lojas na VPS e o usuário mesmo cola numa credencial "Header Auth" do n8n. O Claude
nunca pede o token no chat.

**O que a Kira não faz:** rodar comandos na VPS (o nó Execute Command está desligado e
não há SSH no n8n) nem chamar o Claude. Instalar e consertar na VPS segue a skill
publicar-lojas-vps, com o usuário colando os comandos.

## Modo de evolução: cada tarefa ensina o time

As skills são a memória do time. Quando algo novo funcionar, ou quando o usuário
corrigir o rumo, registre na skill certa com o porquê:

1. Edite a fonte em `skills/<nome>/SKILL.md` no repositório (erro novo vai para
   "Problemas já vistos"; preferência do usuário vai para "O que o usuário valoriza").
2. Valide e empacote com o skill-creator:
   ```bash
   cd <pasta do skill-creator> && python3 -m scripts.quick_validate /home/user/KIRA/skills/<nome>
   python3 -m scripts.package_skill /home/user/KIRA/skills/<nome> <scratchpad>/skills
   ```
3. Mande o `.skill` com `SendUserFile` para o usuário salvar (botão "Save skill") e faça
   commit e push da fonte.
4. Mantenha cada skill enxuta: o que é detalhe vai para `references/` ou para scripts
   testados.

Nunca guarde em skill senha, token, e-mail ou dado de cliente.

## Regras do time

- Nenhum agente faz ação para fora (push em outra branch, apagar, publicar, mexer na VPS,
  postar) sem pedido do usuário.
- Recriar é de sala limpa; nada de réplica de marca (ver nova-loja).
- Mais agentes gastam mais do limite: prefira poucos agentes bem definidos.
- O coordenador fala com o usuário em português simples e diz o que ficou pendente.
