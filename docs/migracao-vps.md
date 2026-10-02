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

1. No n8n Cloud, abra cada workflow da Kira, clique nos **três pontinhos (⋯) ao lado do nome** e em **Download**
   (em português, "JSON de exportação"; não confunda com "Arquivo", que arquiva o workflow). São 12: a Kira, os
   oito sub-workflows (imagens, anexar imagem, Teams, pedidos, internet, planilha do negócio, rascunho com
   assinatura, Power BI) e os agendados (resumo da manhã, rascunhos automáticos, sincronização da base de pedidos).
   Os arquivos vão para a pasta Downloads com o nome começando por "Kira"; `Ctrl + J` no navegador mostra a lista.
2. No PowerShell do computador (não dentro da VPS), separe os arquivos baixados nas últimas 3 horas (deixa de fora
   os `.json` deste repositório, que não têm o ID do workflow), confira que são 12 e copie para a VPS:
   `$arquivos = Get-ChildItem $HOME\Downloads\Kira*.json | Where-Object LastWriteTime -gt (Get-Date).AddHours(-3); $arquivos.Count`
   e depois `scp $arquivos.FullName root@<endereço>:/tmp/`.
3. Entre na VPS (`ssh root@<endereço>`) e rode:
   `mkdir -p /opt/kira/importar && mv /tmp/Kira*.json /opt/kira/importar/` e depois
   `bash /opt/kira/importar-workflows.sh` (baixe de `vps/importar-workflows.sh`). Tudo entra **despublicado**; o
   script pula cópias repetidas e arquivos sem ID, e a lista final mostra ID e nome de cada workflow.

## 3. Tabelas
Crie na VPS as tabelas com os mesmos nomes e colunas da nuvem (os workflows procuram as tabelas pelo nome) e copie
as linhas: `kira_config`, `kira_memoria`, `kira_contatos`, `kira_tarefas`, `kira_imagens`, `kira_linkedin`,
`kira_emails_auto` e o histórico recente de `kira_logs` (a recuperação de histórico quebrado e `buscar_conversas`
usam as últimas conversas).

As linhas copiadas ganham a data da cópia (`createdAt` não pode ser gravado) e a Kira ordena as conversas por essa
data: grave as conversas da mais antiga para a mais nova, uma por vez (como faz o nó Data table ao inserir item a
item; numa inserção em lote todas ficam com o mesmo horário). Para as conversas não passarem por mais ninguém,
copie `kira_logs` direto de um n8n para o outro: um workflow temporário na nuvem lê a tabela e envia por HTTP para
um webhook temporário na VPS (caminho aleatório, despublicado logo depois), que grava e responde só contagens.

## 4. Credenciais (o dono cria na VPS; nunca pelo chat)
O endereço de retorno OAuth da VPS é `https://<endereço>/rest/oauth2-credential/callback` (o n8n mostra na tela
da credencial).

| Credencial | O que precisa |
| --- | --- |
| Gemini (`googlePalmApi`) | A mesma chave gratuita do AI Studio |
| Telegram (`telegramApi`) | O mesmo token do bot |
| Microsoft: Outlook, Teams, OneDrive e SharePoint (OAuth2 API) | Fora do n8n Cloud, o n8n não tem app próprio da Microsoft, e as credenciais prontas do Teams pedem permissões que só o administrador aprova (`User.ReadWrite.All`, `Group.ReadWrite.All`). Use **uma** credencial genérica **OAuth2 API** (`Microsoft (Kira)`) com o app do Entra ID do Power BI: as URLs `authorize` e `token` do locatário, o **ID do aplicativo**, o **Valor** de um segredo, Scope `offline_access openid User.Read Mail.ReadWrite Calendars.Read Chat.ReadWrite ChatMessage.Send Files.ReadWrite Sites.Read.All` (o próprio usuário aprova), `prompt=select_account` e Authentication **Body**. Nos nós HTTP do Graph, troque a autenticação para **Generic Credential Type → OAuth2 API** e escolha essa credencial |
| Google Drive (OAuth2) | Projeto no Google Cloud com a API do Google Drive ativada, tela de consentimento **publicada** (em teste, o login vence em 7 dias) e um cliente OAuth do tipo "Aplicativo da Web" com o endereço de retorno |
| LinkedIn (OAuth2) | App próprio no LinkedIn Developers (ligado a uma página de empresa) com os produtos "Share on LinkedIn" e "Sign In with LinkedIn using OpenID Connect" e o endereço de retorno na aba **Auth**. Na credencial, desligue **Organization Support** e **Legacy** (vêm ligados e fazem o LinkedIn recusar a conexão). O identificador da pessoa muda com o app: nos nós *Publicar no LinkedIn*, escolha a pessoa de novo no campo **Person**. A conexão vale 60 dias; depois, é só clicar em **Conectar** de novo |
| Power BI (OAuth2 API) | A mesma configuração do passo 19 do guia, com o mesmo app; conecte com a conta que vê os modelos |

Depois, ligue cada credencial aos nós que a usam e confira, nos sub-workflows, quem pode chamá-los (a Kira; o
rascunho com assinatura e os pedidos também pelos rascunhos automáticos).

Erro comum ao conectar o LinkedIn: `The redirect_uri does not match the registered value` quer dizer que o endereço de
retorno não foi salvo no app (aba **Auth** → **Authorized redirect URLs** → **Update**). Se o LinkedIn mostrar
"Bummer, something went wrong" e voltar para a VPS, as opções **Organization Support** e **Legacy** estão ligadas.

Erros comuns ao conectar a Microsoft:
- `AADSTS700016 … application … was not found`: o **Client ID** está errado (costuma ser o "ID do segredo" no lugar
  do ID do aplicativo).
- `invalid_client` na volta para o n8n: o **Client Secret** não é o **Valor** do segredo, ou Authentication está em
  Header.

## 5. Testar na VPS, com a Kira e os agendados despublicados
- Publique os sub-workflows: eles só rodam quando chamados, e a Kira não consegue usar ferramenta despublicada
  ("Workflow is not active and cannot be executed").
- Sub-workflows: `test_workflow` com dados reais (pedidos, internet, Power BI, planilha, Teams, rascunho).
- Kira: `test_workflow` com o "Telegram Trigger" fixado (chat de teste fictício), lendo a resposta em `kira_logs`.
- Resumo da manhã e rascunhos automáticos: uma execução manual de cada.
- Sincronização da base de pedidos: "Atualizar agora". Numa VPS pequena, cada etapa da leitura da planilha prende
  o executor de código por mais tempo que na nuvem; sem folga, a etapa é cancelada com "Task execution aborted
  because runner became unresponsive". O `instalar.sh` já define `N8N_RUNNERS_HEARTBEAT_INTERVAL=300`; numa
  instalação anterior, acrescente essa linha em `environment` no `/opt/kira/docker-compose.yml` e rode
  `docker compose up -d`.

## 6. Virada
1. Na VPS, confira que os sub-workflows estão publicados.
2. No n8n Cloud, despublique a Kira, o resumo da manhã, os rascunhos automáticos e a sincronização da base.
3. Na VPS, publique a Kira (o Telegram passa a entregar as mensagens para a VPS) e os três agendados.
4. Mande uma mensagem real para a Kira e confira `/status`.

Despublicar a Kira apaga o endereço de entrega (webhook) do bot no Telegram, mesmo que ele já aponte para o outro
n8n. Por isso a ordem importa: primeiro despublique na nuvem, depois publique na VPS. Se a Kira da VPS não responder e
o log mostrar `Workflow partially published; some triggers failed to activate` (`docker compose logs n8n | grep
"partially"`, dentro de `/opt/kira`), a entrada do Telegram não ligou: despublique e publique a Kira de novo na VPS.
Mensagens mandadas enquanto nenhuma Kira recebe não se perdem: o Telegram guarda e entrega quando o endereço volta (às
vezes alguns minutos depois).

Depois da virada, copie da nuvem o que mudou desde a cópia das tabelas: as conversas novas de `kira_logs` (pelo mesmo
caminho direto de um n8n para o outro) e as linhas novas das outras tabelas (compare o `updatedAt` de cada tabela).

## 7. Depois
- Backup: a pasta `/opt/kira` (tem a chave das credenciais) e o volume `kira_n8n_data`.
- Atualizar: `dnf -y upgrade` (sistema) e `cd /opt/kira && docker compose pull && docker compose up -d` (n8n).
