# Infinite Semijoias: trazer o site do terceiro para a nossa VPS

Levantamento feito em 07/11/2026 em https://infinitesemijoias.store/.

## O que o terceiro entregou

Não é um site de plataforma pronta (Nuvemshop, Shopify, Wix, Lovable...). É um sistema
**feito sob medida**, em Astro com servidor próprio:

| Parte | O que tem |
|---|---|
| Vitrine | início com abertura animada, catálogo com busca e ordenação, 10 categorias, página de produto com opções (Ouro/Ródio), estoque e selo "Últimas unidades" |
| Compra | sacola, checkout, cálculo de frete por CEP (Correios PAC/SEDEX e motoboy local), Mercado Pago (Pix, cartão em 6x, boleto), frete grátis acima de R$ 300 |
| Clientes | conta com login (`/conta`), avaliações só de quem comprou, newsletter com confirmação por e-mail |
| Revenda | "Seja revendedora": cadastro, maleta em consignado, portal no celular, comissão por link |
| "App" | é um **PWA**: o site se instala na tela inicial e manda notificações (`/manifest.webmanifest`, `/sw.js`). Não há app de loja (Play Store / App Store) |
| Painel | `/admin` com login (não temos acesso) |
| Outros | estatísticas próprias em `analytics.infinitesemijoias.store` (Umami), formulário de contato, páginas legais (termos, privacidade LGPD, trocas) |
| Catálogo | **469 peças**, a maioria ainda **sem foto** e com descrição genérica |

Dona: JANAINA DE SOUZA OLIVEIRA, CNPJ 53.930.694/0001-22, Juatuba/MG.
WhatsApp 55 31 97500-1789, Instagram @infinitesemijoiasoficial, e-mail
infinitesemijoiasoficial@gmail.com.

## O que dá e o que não dá para copiar pelo site

Pelo endereço público só sai o que qualquer visitante vê: textos, fotos, preços,
opções, estoque, logotipos. **Não sai** o código-fonte do servidor, o banco de dados
(clientes, pedidos, contas, revendedoras, avaliações, inscritos na newsletter), as
senhas e chaves (Mercado Pago, e-mail) nem o painel. Copiar só as páginas prontas
geraria um site "de vitrine" com sacola, conta, frete e pagamento quebrados.

## Dois caminhos

### A. Pedir ao terceiro o sistema completo (recomendado se ele colaborar)

Mantém tudo que já funciona (revendedoras, contas, avaliações, PWA) e só muda de casa.
A Janaina pagou pelo site, então pode exigir (vale conferir o contrato):

1. **Código-fonte** (repositório Git: GitHub/GitLab) ou um `.zip` do projeto.
2. **Banco de dados**: exportação completa (`pg_dump`, `mysqldump` ou o arquivo SQLite)
   e a pasta de **fotos enviadas** (as que aparecem em `/foto/...`).
3. **Lista das configurações** (arquivo `.env` sem precisar mandar por WhatsApp; pode
   ser num arquivo protegido): Mercado Pago, e-mail de envio, Correios, Umami, chaves do
   push (VAPID).
4. **Acesso ao domínio** `infinitesemijoias.store`: em qual empresa foi registrado
   (Hostinger, GoDaddy, Registro.br não vende `.store`...) e o login, **no nome e no
   e-mail da Janaina**. Sem isso não dá para apontar o domínio para a nossa VPS.
5. Instrução de como ele roda o sistema (Node? Docker? qual banco?).

Com isso em mãos: o Claude monta o `docker-compose` dele ao lado do n8n e das nossas
lojas, testa numa VPS simulada, a Janaina aponta o DNS para `177.153.67.118` e o Caddy
emite o HTTPS (mesmo processo da skill publicar-lojas-vps).

Texto pronto para mandar ao terceiro:

> Olá! Vamos centralizar o site da Infinite na nossa própria hospedagem. Preciso que você
> me envie: (1) o código-fonte completo do site (repositório Git ou .zip), (2) uma cópia
> do banco de dados e da pasta de fotos, (3) a lista de configurações/integrações usadas
> (Mercado Pago, e-mail, Correios, analytics, notificações) e (4) os dados de acesso de
> onde o domínio infinitesemijoias.store está registrado, já no nome e e-mail da
> Janaina. Se tiver um passo a passo de como você publica, ajuda muito. Obrigada!

### B. Levar a Infinite para a nossa plataforma (`lojas/`, já pronta)

A plataforma da BG Imports já tem a loja `infinite` cadastrada (tema "elegante") com
catálogo de exemplo. Este levantamento já deixa pronto:

| Pasta | Conteúdo |
|---|---|
| `catalogo/infinite-catalogo.csv` | as 469 peças no formato do importador (Produtos → Importar): nome, categoria, opção, código, preço, estoque |
| `catalogo/fotos.json` | quais fotos pertencem a cada peça |
| `catalogo/catalogo.json` | tudo que foi lido do site, em bruto |
| `fotos/` | as fotos das peças em tamanho grande |
| `identidade/` | logotipos, banners do início, ícones do app |
| `textos/` | quem somos, onde comprar, contato, entregas, trocas, disposições legais, termos, privacidade, seja revendedora |
| `telas/` | prints do site atual (referência de visual) |

Ganhamos tudo num lugar só (ERP, estoque, financeiro, Mercado Livre, Shopee, Google,
API da Kira), sem depender do terceiro. **Perdemos**, até serem refeitos na plataforma:
portal das revendedoras/maleta consignada, conta do cliente com avaliações, newsletter
e o PWA com notificações. Clientes e pedidos antigos ficam no sistema do terceiro.

Próximos passos do caminho B:

1. Tema da Infinite no visual do site atual (fundo preto `#0B0B0C`, dourado `#b89a67`, texto `#f3efe6`,
   Cormorant Garamond + DM Sans, banners e logos desta pasta), com prévia antes de
   publicar (skill previa-loja).
2. Importar `infinite-catalogo.csv` no painel e as fotos com um script (o importador
   atual não lê fotos).
3. Copiar os textos legais para as páginas da loja.
4. Ligar o domínio com `vps-dominio.sh infinitesemijoias.store infinite` **depois** que o
   DNS apontar para `177.153.67.118` (precisa do acesso ao registro do domínio, item A4).

Enquanto o domínio não vem, a loja pode rodar em `https://infinite.177-153-67-118.sslip.io`.

## Como refazer este levantamento

Os scripts usados ficam em `scripts/`: `raspar.py` lê o catálogo pelo sitemap (uma
página por vez, com pausa) e `converter.py` gera a planilha. O ambiente precisa ter
`infinitesemijoias.store` liberado na rede.
