# Migração da Kira do n8n Cloud para a VPS

Roteiro para levar a Kira do n8n Cloud para o n8n instalado na VPS **sem parar a Kira que está funcionando**: a
Kira da nuvem segue no ar até a da VPS estar testada, e a virada leva minutos.

Na conversa com o Claude, os dois n8n aparecem como conectores MCP: **n8n** (nuvem, origem) e **n8n VPS** (destino).
Um conector novo só aparece numa conversa nova.

## 1. Instalar o n8n na VPS ✔
`vps/instalar.sh <endereço da VPS>` (veja "Rodar na VPS" em [configuracao.md](configuracao.md#rodar-na-vps-opcional)).
Depois: conta de dono, verificação em duas etapas (2FA) e **MCP em nível de instância** ligado.

## 2. Copiar os workflows, mantendo os IDs
Os IDs iguais mantêm as ligações entre a Kira e os sub-workflows (ferramentas `workflowId`) e a lista de quem pode
chamar cada sub-workflow.

1. No n8n Cloud, abra cada workflow da Kira e use **⋯ → Download**. São 12: a Kira, os oito sub-workflows
   (imagens, anexar imagem, Teams, pedidos, internet, planilha do negócio, rascunho com assinatura, Power BI) e os
   agendados (resumo da manhã, rascunhos automáticos, sincronização da base de pedidos).
2. No PowerShell do computador (não dentro da VPS), copie os arquivos para a VPS:
   `ssh root@<endereço> "mkdir -p /opt/kira/importar"` e depois
   `scp (Get-ChildItem $HOME\Downloads\Kira*.json).FullName root@<endereço>:/opt/kira/importar/`.
3. Na VPS: `bash /opt/kira/importar-workflows.sh` (baixe de `vps/importar-workflows.sh`). Tudo entra
   **despublicado** e a lista final mostra ID e nome de cada workflow.

## 3. Tabelas
Crie na VPS as tabelas com os mesmos nomes e colunas da nuvem (os workflows procuram as tabelas pelo nome) e copie
as linhas: `kira_config`, `kira_memoria`, `kira_contatos`, `kira_tarefas`, `kira_imagens`, `kira_linkedin`,
`kira_emails_auto` e o histórico recente de `kira_logs` (a recuperação de histórico quebrado e `buscar_conversas`
usam as últimas conversas).

## 4. Credenciais (o dono cria na VPS; nunca pelo chat)
O endereço de retorno OAuth da VPS é `https://<endereço>/rest/oauth2-credential/callback` (o n8n mostra na tela
da credencial).

| Credencial | O que precisa |
| --- | --- |
| Gemini (`googlePalmApi`) | A mesma chave gratuita do AI Studio |
| Telegram (`telegramApi`) | O mesmo token do bot |
| Microsoft Outlook e Microsoft Teams (OAuth2) | Fora do n8n Cloud, o n8n não tem app próprio da Microsoft: use um app do Entra ID (pode ser o mesmo do Power BI), com o endereço de retorno da VPS, o ID do aplicativo e o **Valor** de um segredo. Ao conectar, aceite as permissões. A sincronização da base de pedidos usa a credencial do Teams para ler o SharePoint e o OneDrive |
| Google Drive (OAuth2) | Projeto no Google Cloud com a API do Google Drive ativada, tela de consentimento **publicada** (em teste, o login vence em 7 dias) e um cliente OAuth do tipo "Aplicativo da Web" com o endereço de retorno |
| LinkedIn (OAuth2) | App no LinkedIn Developers com "Share on LinkedIn" e "Sign In with LinkedIn using OpenID Connect" e o endereço de retorno |
| Power BI (OAuth2 API) | A mesma configuração do passo 19 do guia; acrescente o endereço de retorno da VPS no app |

Depois, ligue cada credencial aos nós que a usam e confira, nos sub-workflows, quem pode chamá-los (a Kira; o
rascunho com assinatura e os pedidos também pelos rascunhos automáticos).

## 5. Testar na VPS, com tudo despublicado
- Sub-workflows: `test_workflow` com dados reais (pedidos, internet, Power BI, planilha, Teams, rascunho).
- Kira: `test_workflow` com o "Telegram Trigger" fixado (chat de teste fictício), lendo a resposta em `kira_logs`.
- Resumo da manhã e rascunhos automáticos: uma execução manual de cada.

## 6. Virada
1. Na VPS, publique os sub-workflows.
2. No n8n Cloud, despublique a Kira, o resumo da manhã, os rascunhos automáticos e a sincronização da base.
3. Na VPS, publique a Kira (o Telegram passa a entregar as mensagens para a VPS) e os três agendados.
4. Mande uma mensagem real para a Kira e confira `/status`.

## 7. Depois
- Backup: a pasta `/opt/kira` (tem a chave das credenciais) e o volume `kira_n8n_data`.
- Atualizar: `dnf -y upgrade` (sistema) e `cd /opt/kira && docker compose pull && docker compose up -d` (n8n).
