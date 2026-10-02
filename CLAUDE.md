# Kira: regras do projeto para o Claude

A Kira é a assistente pessoal do dono: Telegram + n8n + Google Gemini (chave gratuita). Este repositório guarda a
versão **genérica** dos workflows, os testes e a documentação; a versão real roda no n8n do dono.

## Conversa com o dono
- Responda sempre em **português do Brasil**, com linguagem simples: o dono não é técnico. Passos numerados, um
  de cada vez, dizendo onde clicar e o que deve aparecer na tela.
- Tudo precisa ser **gratuito** (Gemini com chave gratuita, n8n instalado na VPS, apps OAuth próprios).
- **Nunca peça nem aceite** senhas, tokens, chaves de API ou segredos no chat: eles vão direto nas credenciais do
  n8n ou no gerenciador de senhas do dono. Se ele colar um segredo, não repita o valor e oriente a trocar.
- Não repita o IP da VPS no chat (o nome da VPS basta).
- Nas respostas, só contagens e totais de dados da empresa: nunca repita nomes de colegas, clientes ou vendedores.

## Repositório público
- Nunca commitar: nome da empresa, do ERP ou dos negócios do dono, perfil pessoal, endereço da instância n8n, IDs
  (Telegram, workflows, credenciais, tabelas, Power BI, Azure), e-mails ou nomes de pessoas.
- A versão do repositório usa os ambientes genéricos TRABALHO, NEGOCIOS e PESSOAL; a versão real usa os nomes
  reais. Antes de commitar, faça uma varredura com grep pelos nomes e IDs reais.
- Commits em português; rode `npm test` (scripts/testar-codigo.mjs) antes.

## Kira no n8n
- Não apague nem quebre a Kira que está funcionando: mude passo a passo, teste e só então publique.
- Ambientes: nunca misture informações entre ambientes sem autorização do dono. Ferramentas restritas a um
  ambiente recebem o ambiente pelo workflow (nó "Ambiente atual"), nunca pela IA.
- Teste a Kira com `test_workflow` fixando só o nó "Telegram Trigger" (um chat de teste fictício e o `from.id` do
  dono) e leia a resposta em `kira_logs` pelo `execucao_id`. O ambiente ativo fica em `kira_config`: se um teste
  trocar o ambiente, volte ao que estava.
- Nós Code: "uma vez para todos" devolve lista; "uma vez por item" devolve objeto. Nada de credenciais dentro de
  nós Code. Evite escapes `\uXXXX` nos parâmetros das ferramentas (o transporte decodifica): use `\p{M}` com a
  flag `u` ou o próprio caractere.
- Workflows sem trigger de agenda ou Telegram são sub-workflows (ferramentas) chamados só pela Kira (Settings →
  "This workflow can be called by").

## Estrutura
- `n8n/sdk/*.workflow.ts`: workflows no formato do n8n Workflow SDK; `n8n/workflows/*.json`: os mesmos para importar.
- `docs/configuracao.md` (passo a passo e solução de problemas), `docs/arquitetura.md`, `docs/persona-kira.md`.
- `vps/instalar.sh` (n8n na VPS com HTTPS) e `vps/importar-workflows.sh`; migração: `docs/migracao-vps.md`.
