# Kira + MarketUP da Infinite

A Kira consulta o MarketUP da Infinite Semijoias (`infinitejs.marketup.com`) pela ferramenta
`consultar_marketup`, só no **modo Negócios** e **só para ler**: ela não cria, não altera e não apaga nada no sistema.

- Workflow da ferramenta no n8n: **Kira — MarketUP da Infinite (ferramenta)** (código em `kira-marketup-ferramenta.js`, no formato do n8n Workflow SDK).
- Na Kira 2.0, a ferramenta `consultar_marketup` fica no grupo "Cérebro da Kira".
- A Kira usa a mesma API que o site usa (`api-erp.marketup.com`): entra com o login da conta e lê os dados.

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

## Ainda não faz

- Cadastrar ou publicar produtos sozinha: por enquanto ela ensina e confere. Dá para automatizar depois que o login estiver ligado e der para ver um produto real pela API.
