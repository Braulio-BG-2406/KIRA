# Lojas: site de vendas + ERP

Uma plataforma só para as duas lojas, **Infinite Semijoias** e **BG Imports**. Cada loja tem a própria vitrine, com nome, cores, logo e domínio dela, e o mesmo painel de gestão cuida das duas. Dá para criar mais lojas pelo painel.

## O que já funciona

**Vitrine (o que o cliente vê)**
- Página inicial com destaques, categorias, busca e página de produto com variações (aro, cor, banho…) e fotos
- Carrinho e checkout com CEP automático (ViaCEP), frete por estado, frete grátis acima de um valor, retirada e cupom de desconto
- Pagamento por **Pix** (QR Code e copia e cola gerados com o valor do pedido, sem taxa), **Mercado Pago** (cartão, Pix e boleto, com confirmação automática) ou **combinar pelo WhatsApp**
- Página do pedido para o cliente acompanhar o andamento e o rastreio
- Botão de WhatsApp em todas as páginas
- Funciona bem no celular

**Painel (ERP), em `/admin`**
- Início: vendas do dia e do mês, ticket médio, lucro bruto, pedidos pendentes e estoque baixo
- Pedidos: confirmar pagamento, separar, enviar com código de rastreio, entregar, cancelar (o estoque volta sozinho), imprimir, chamar o cliente no WhatsApp
- Nova venda: registra as vendas do WhatsApp, do Instagram e do balcão, com baixa no estoque
- Produtos: variações com preço, preço "de", custo, margem e estoque, além de fotos, categorias e importação por planilha
- Estoque: entradas, saídas, contagem, histórico de cada movimento e valor parado em estoque
- Clientes: cadastro automático pela compra e histórico de pedidos
- Compras e fornecedores: a entrada da mercadoria soma ao estoque, recalcula o custo médio (com o frete rateado) e lança a conta a pagar
- Financeiro: contas a pagar e a receber por mês, atrasadas em vermelho. As vendas pagas entram sozinhas.
- Cupons de desconto (% ou R$), com validade, mínimo e limite de usos
- Relatórios por período (por dia, por canal, por forma de pagamento, produtos mais vendidos com margem) e exportação em CSV, que abre no Excel
- Configurações: dados da loja, cores, logo, Pix, frete, equipe, troca de senha e criação de lojas novas
- Pedido do site não pago em 48 h (configurável) é cancelado e o estoque volta

**Para a Kira**: uma API só de leitura (veja abaixo) para ela responder "quanto vendi hoje?", "tem pedido para enviar?" ou "o que está acabando?".

## Rodar no computador

Precisa de Node 20+ e PostgreSQL.

```bash
cd lojas
cp .env.example .env            # ajuste DATABASE_URL, ADMIN_EMAIL e ADMIN_SENHA
npm install
npm run db:migrate              # cria as tabelas
npm run db:demo                 # cria as 2 lojas, o seu usuário e um catálogo de EXEMPLO
npm run dev
```

- Vitrines: http://localhost:3000/loja/infinite e http://localhost:3000/loja/bg-imports
- Painel: http://localhost:3000/admin

Para começar sem produtos de exemplo, use `npm run db:seed` no lugar de `db:demo`.

## Colocar na VPS (Docker)

Na VPS (a mesma do n8n serve):

```bash
git clone <este repositório> && cd KIRA/lojas
cp .env.example .env
nano .env        # DB_SENHA, ADMIN_EMAIL, ADMIN_SENHA, APP_URL, LOJA_DOMINIOS, KIRA_API_TOKEN
docker compose up -d --build
```

A plataforma sobe só para dentro da VPS (`127.0.0.1:3000`). Para publicar com HTTPS, aponte os domínios no proxy que você já usa. Exemplo com **Caddy**:

```
infinitesemijoias.com.br, www.infinitesemijoias.com.br, bgimports.com.br, www.bgimports.com.br, painel.seudominio.com.br {
    reverse_proxy 127.0.0.1:3000
}
```

No `.env`, diga qual domínio é de qual loja:

```
APP_URL=https://painel.seudominio.com.br
LOJA_DOMINIOS=infinitesemijoias.com.br=infinite,www.infinitesemijoias.com.br=infinite,bgimports.com.br=bg-imports,www.bgimports.com.br=bg-imports
```

No DNS de cada domínio, crie um registro **A** apontando para o IP da VPS. Enquanto o domínio não estiver pronto, as lojas já funcionam em `https://<APP_URL>/loja/infinite`.

Para atualizar depois: `git pull && docker compose up -d --build`. As migrações rodam sozinhas.

### Backup

Os dados ficam no volume `banco` (PostgreSQL) e as fotos no volume `fotos`. Exemplo de backup diário do banco:

```bash
docker compose exec -T db pg_dump -U lojas lojas | gzip > backup-lojas-$(date +%F).sql.gz
```

Esse comando pode entrar no backup de domingo que a Kira já faz no n8n.

## Pagamentos

**Pix**: em Configurações → Pagamento, informe a chave, o nome do recebedor e a cidade. O cliente recebe QR Code e copia e cola com o valor exato e o número do pedido. Quando o dinheiro cair, clique em **Confirmar pagamento** no pedido. Não tem taxa.

**Mercado Pago**: pegue o *Access Token* de produção em mercadopago.com.br/developers (Suas integrações → Credenciais) e coloque no `.env`:

```
MERCADOPAGO_TOKEN_INFINITE=APP_USR-...
MERCADOPAGO_TOKEN_BG_IMPORTS=APP_USR-...
```

A opção aparece sozinha no checkout. O aviso de pagamento chega em `APP_URL/api/pagamentos/mercadopago/<loja>`, e o pedido vira "Pago" sozinho. A plataforma sempre confere o pagamento direto na API do Mercado Pago antes de aceitar. O `APP_URL` precisa ser público e com https.

## Trazer o catálogo do MarketUP

Exporte os produtos do MarketUP (ou de qualquer planilha) em CSV e use **Produtos → Importar planilha**. As colunas aceitas são `nome, categoria, variacao, sku, preco, preco_de, custo, estoque, descricao, ativo`, e só `nome` e `preco` são obrigatórias. Linhas com o mesmo nome viram variações do mesmo produto, e um SKU que já existe atualiza preço e estoque. Em Relatórios, "Produtos e estoque (CSV)" sai nesse mesmo formato, então dá para editar no Excel e importar de volta.

## Ligar na Kira (n8n)

Defina `KIRA_API_TOKEN` no `.env` (um texto longo e aleatório) e, no n8n, use um nó **HTTP Request** com o cabeçalho `Authorization: Bearer <token>`:

| Chamada | O que devolve |
| --- | --- |
| `GET /api/kira/resumo` | vendas de hoje e do mês, ticket médio, lucro bruto, pedidos aguardando pagamento e para enviar, estoque baixo e financeiro do mês, por loja |
| `GET /api/kira/pedidos?status=aguardando_pagamento,pago,separacao` | pedidos em aberto, com cliente, telefone e link do painel |
| `GET /api/kira/estoque-baixo` | o que está acabando |
| `GET /api/kira/produtos?q=anel` | busca no catálogo, com preço e estoque |
| `GET /api/kira/clientes?q=maria` | busca de clientes |
| `POST /api/kira/manutencao` | cancela pedidos vencidos e devolve o estoque (bom para rodar de hora em hora) |

Todas aceitam `?loja=infinite` ou `?loja=bg-imports`; sem esse parâmetro, trazem as duas. Os valores vêm em centavos. A API só lê e não altera nada, fora a manutenção.

## Testes

```bash
npm test               # regras: pedidos, estoque, cupom, frete, Pix, compras, financeiro, Mercado Pago (precisa de um PostgreSQL de teste)
npm run build && npm run test:e2e   # navegador de verdade: compra no site, painel, foto, API da Kira
```

## Ainda não faz (próximos passos)

- **Nota fiscal (NF-e/NFC-e)**: precisa do certificado digital A1 da empresa e de um emissor (Focus NFe, NFE.io, eNotas…)
- **Frete calculado pelos Correios/Melhor Envio**: hoje o frete é por tabela de estado
- **E-mail automático** de confirmação para o cliente (hoje o aviso é pela página do pedido e pelo WhatsApp)
- Avisos da Kira no Telegram a cada pedido novo (dá para fazer no n8n consultando `/api/kira/pedidos`)

## Como é feito

Next.js 15 (React 19) com Tailwind, PostgreSQL via Drizzle ORM, testes com Vitest e Playwright. Os valores em dinheiro são guardados em centavos. O código está em `src/`: `lib/` tem as regras de negócio, `app/loja` a vitrine, `app/admin` o painel e `app/api` as rotas.
