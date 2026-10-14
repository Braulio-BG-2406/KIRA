# Kira + MarketUP da Infinite

A Kira consulta o MarketUP da Infinite Semijoias (`infinitejs.marketup.com`) pela ferramenta
`consultar_marketup`, só no **modo Negócios** e **só para ler**: ela não cria, não altera e não apaga nada no sistema.

- Workflow da ferramenta no n8n: **Kira — MarketUP da Infinite (ferramenta)** (código em `kira-marketup-ferramenta.js`, no formato do n8n Workflow SDK).
- Na Kira 2.0, a ferramenta `consultar_marketup` fica no grupo "Cérebro da Kira".
- A Kira usa a mesma API que o site usa (`api-erp.marketup.com`): entra com o login da conta e lê os dados.
- O login é o mesmo da tela `infinitejs.marketup.com`: `POST /v1/auth/authenticate-user` com `Domain: infinitejs` e `LoginType: 1` (login e senha). O acesso volta em `AuthToken` (vale 2 horas) e a Kira entra de novo a cada consulta. O outro endereço de login (`/v1/auth/authenticateUserWithDomain`, da tela geral do MarketUP) recusa o mesmo e-mail e senha: não use.
- Situações do pedido (`Status`): 1 Novo, 2 Faturado, 3 Entrega parcial, 4 Não conformidade, 5 Atrasado, 6 Finalizado, 7 Cancelado, 8 NF-e solicitada, 9 Aguardando pagamento, 10 Pago, 11 Consignado, 12 Enviado. Entrega: 1 Pendente, 2 Entregue, 3 Entrega parcial, 4 Atrasado, 5 Devolução parcial, 6 Devolvido, 7 Cancelado. Financeiro: 1 Pendente, 2 Pago. A Kira já mostra os nomes.

## O que a Kira faz

| Ação | O que traz |
| --- | --- |
| `verificar` | Se o site está no ar, se o login funciona, quantos produtos e pedidos há, os últimos pedidos e se a integração com a Loja Integrada está ativa |
| `pedidos` / `pedido` | Lista de pedidos de venda (por número, cliente ou os mais recentes) e os detalhes de um pedido |
| `produtos` / `produto` | Busca de produtos e o cadastro completo de um, com o que falta para publicar (fotos, peso e medidas, loja virtual) |
| `loja_integrada` | Produtos que estão na integração com a Loja Integrada |
| `como_publicar` | Passo a passo para cadastrar e publicar um produto novo (funciona mesmo sem login) |

Exemplos no Telegram (depois de `modo negócios`):

- "Kira, verifica o MarketUP"
- "Quais foram os últimos pedidos?"
- "Como eu publico um produto novo?"
- "Confere o cadastro do brinco gota: falta alguma coisa para publicar?"

## Ligar o login (uma vez só)

A senha fica guardada criptografada no n8n. Não mande a senha pelo Telegram nem pelo chat.

1. No n8n, abra **Credentials** > **Add credential** e escolha **Custom Auth**.
2. Dê o nome `MarketUP (Infinite)`.
3. No campo JSON, cole e troque pelo seu e-mail e sua senha do MarketUP:

   ```json
   {
     "body": {
       "Login": "seu-email-do-marketup",
       "Password": "sua-senha-do-marketup"
     }
   }
   ```

4. Salve.
5. Abra o workflow **Kira — MarketUP da Infinite (ferramenta)**, clique no passo **Entrar no MarketUP**, escolha a credencial `MarketUP (Infinite)`, salve e publique.
6. No Telegram: `modo negócios` e depois "Kira, verifica o MarketUP".

Se a senha do MarketUP mudar, é só atualizar essa credencial.

### Se a Kira disser que o login não deu certo

- A credencial tem de estar no n8n da Kira, `https://vps71390.publiccloud.com.br` (não no n8n Cloud), na conta do Braulio: **Credentials > MarketUP (Infinite)**. Credencial criada em outro n8n ou com outro usuário não chega à Kira.

- **"Usuário ou senha inválidos no MarketUP"**: o MarketUP recebeu o pedido e recusou.
  - Confira o JSON da credencial: tem de estar dentro de `"body"`, com `Login` e `Password` exatamente assim (L e P maiúsculos), sem espaço antes ou depois do e-mail e da senha. Se a senha tiver `"` ou `\`, escreva `\"` ou `\\`.
  - Teste o mesmo e-mail e a mesma senha em `infinitejs.marketup.com`, numa janela anônima.
  - Se você entra com o botão do Google, a conta não tem senha do MarketUP: crie uma em "recuperar a senha" ou, melhor, crie um usuário só para a Kira (abaixo).
- **"does not have any credentials set"**: a credencial não está escolhida no passo **Entrar no MarketUP**.

Dica de segurança: crie no MarketUP um usuário só para a Kira, com um perfil que só pode ver (sem incluir, alterar ou excluir), e use esse login na credencial.

## Passo a passo para publicar um produto novo

O que a Kira ensina com `como_publicar` (MarketUP → Loja Integrada, a integração ativa nesta conta):

1. Entrar em `infinitejs.marketup.com`.
2. **Catálogo > Produtos > Adicionar novo**.
3. Código de barras: digitar e clicar em **Localizar item**; sem código, usar a opção da tela (o sistema gera um).
4. Obrigatórios (em cinza escuro): **Descrição**, **Tipo de item**, **Unidade**, **Custo** e **Venda**.
5. **Categoria**, **Subcategoria** e **Marca** (criar antes em Catálogo > Categorias / Marcas, se precisar); **Cor** e **Tamanho** se houver variação.
6. Estoque inicial e local de estoque.
7. Fotos da peça (a primeira vira a capa).
8. Aba **Loja Virtual**: marcar para vender na loja virtual; nome na loja, descrição, garantia, itens inclusos, especificações, peso e medidas (o frete usa).
9. **Salvar**.
10. **Integrações > Loja Integrada**: vincular ou enviar o produto novo (sincronizar do MarketUP).
11. Conferir na Loja Integrada: nome, preço, estoque e fotos.

Antes de publicar: preço conferido com a precificação (`consultar_infinite`, `simular_preco`), foto boa, peso e medidas, estoque maior que zero e categoria certa.

Os nomes dos menus podem variar um pouco entre versões do MarketUP; se algum botão não bater, mande um print para a Kira.

## Atualização automática da planilha BD INFINITE

Workflow no n8n: **Kira — atualizar relatórios da BD INFINITE** (código em `atualizar-relatorios-bd-infinite.js`).
Substitui o trabalho de baixar os relatórios do MarketUP à mão e colocar nas pastas da planilha.

- **Quando:** todo dia às 6h52 (horário de São Paulo). Para rodar na hora: abrir o workflow e clicar em **Rodar agora**.
- **O que baixa:** os mesmos 4 arquivos do botão "Exportar > Excel" do site, no mesmo formato (Excel 97-2003, aba `Plan 1`):

  | Arquivo | Relatório no MarketUP | Período |
  | --- | --- | --- |
  | `RelatorioCarteiraClientes.xls` | Carteira de Clientes | 01/06/2024 (início da loja) até hoje |
  | `RelatorioVendasTotais.xls` | Vendas Totais por Item | 01/06/2024 até hoje |
  | `RelatorioVendasVendedor.xls` | Vendas por Vendedor | 01/06/2024 até hoje |
  | `RelatorioEstoqueLocalizacaoStatus.xls` | Estoque por Localização | posição de hoje |

- **Onde grava:** troca o conteúdo de cada arquivo nas pastas `JOIAS\BD INFINITE V2\<Relatorio...>` do Google Drive
  (Computadores > Meu laptop). O Google Drive do computador baixa sozinho para
  `C:\Users\janai\Desktop\JANAINA\JOIAS\BD INFINITE V2\...`, que é de onde a planilha `Nova BD INFINITE v3.xlsx` lê.
  O arquivo é trocado no lugar (mesmo nome), sem criar cópias: a planilha soma **todos** os arquivos de cada pasta,
  então cada pasta deve ter só o seu `.xls`.
- **Segurança:** primeiro baixa e confere os 4 relatórios; se algum vier errado, para e não troca nada.
  Se der erro, a Kira avisa no Telegram. O Drive guarda as versões anteriores de cada arquivo
  (botão direito > Gerenciar versões) se precisar voltar.
- **Login:** usa a mesma credencial `MarketUP (Infinite)` da ferramenta da Kira.

### Para a planilha atualizar sozinha ao abrir

Os arquivos chegam sozinhos na pasta, mas o Excel só lê quando a planilha é atualizada. Uma vez só, no Excel:

1. Abrir `Nova BD INFINITE v3.xlsx`.
2. **Dados > Consultas e Conexões**.
3. Em cada uma das 4 consultas `BD INFINITE CARTEIRA DE CLIENTES`, `BD INFINITE POSIÇÃO DE ESTOQUE`,
   `BD INFINITE TOTAL DE VENDAS` e `BD INFINITE VENDAS POR VENDEDOR`:
   botão direito > **Propriedades** > marcar **Atualizar dados ao abrir o arquivo** > OK.
4. Salvar.

Depois disso é só abrir a planilha: ela já vem com os dados do dia.

### Como o download funciona (para manutenção)

- Endereço: `GET https://api-erp.marketup.com/v1/<Controller>/Export<Relatorio>?authorization=<AuthToken>&request=<pedido>`,
  com o pedido em JSON codificado em base64 (o mesmo que o site monta em `buildExportRequest('xls')`).
- Junto vão o cookie `authorization=<AuthToken>|<validade>|infinitejs` e o cabeçalho `x-auth-token` (domínio da conta),
  como o navegador faz. Sem eles o MarketUP responde `401 Unauthorized`.
- Se o MarketUP mudar as colunas, a planilha pode deixar de ler: confira as colunas esperadas nas consultas do Power Query.
- Se as pastas mudarem de lugar, troque os IDs das pastas no passo **Baixar e conferir relatórios** e no **Ver arquivos das pastas**.
- No arquivo deste repositório, o aviso de erro usa `SEU_ID_DO_TELEGRAM` e credenciais pelo nome; no n8n já estão o ID
  do dono e as credenciais `Google Drive account` e `Telegram account` escolhidas.

## Ainda não faz

- Cadastrar ou publicar produtos sozinha: por enquanto ela ensina e confere. Dá para automatizar depois que o login estiver ligado e der para ver um produto real pela API.
