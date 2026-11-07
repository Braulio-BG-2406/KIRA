---
name: nova-loja
description: Cria uma loja nova, ou muda visual, textos e catálogo de uma loja existente, na plataforma de vendas + ERP do repositório Braulio-BG-2406/KIRA (pasta lojas/ - Next.js e PostgreSQL, várias lojas num sistema só, painel enxuto inspirado no MarketUP), a mesma da BG Imports (tema relojoaria) e da Infinite Semijoias (tema elegante). Cobre cadastro da loja, tema e cores a partir de referências (Instagram, sites de grandes marcas), categorias, catálogo por planilha, Pix, frete, cupons, canais (Mercado Livre, Shopee, Google, Instagram), testes e a entrega para a prévia e a publicação. Use sempre que o usuário pedir site de vendas, loja virtual, e-commerce ou ERP para uma marca ou negócio, quiser mudar layout, tema, cores ou textos de uma das lojas, criar categorias ou catálogo, ou ligar uma loja a marketplaces, mesmo sem falar em plataforma.
---

# Nova loja (ou novo visual) na plataforma

Uma única plataforma atende várias lojas. Cada loja é uma linha na tabela `lojas`
(slug, nome, slogan, sobre, cores, tema, WhatsApp, Instagram, Pix, frete, desconto no
Pix, parcelas). O domínio decide qual loja aparece (`LOJA_DOMINIOS`); sem domínio, a loja
fica em `/loja/<slug>`. O painel `/admin` cuida de uma loja por vez (seletor "Trocar" na
barra lateral) e tem: vendas e PDV, produtos com variações e fotos, estoque, compras com
custo médio, financeiro, clientes, fornecedores, cupons, relatórios, canais e
configurações. Já existem Pix (BR Code), Mercado Pago, frete por UF, Mercado Livre,
Shopee, feed para Google e Meta, sitemap, Pixel/GA4 e uma API só de leitura para a Kira.

## Mapa do código (`lojas/`)

| O quê | Onde |
|---|---|
| Tabelas | `src/db/schema.ts` (migrações em `drizzle/`, geradas com `npm run db:generate`) |
| Lojas e catálogo de exemplo | `scripts/seed.ts` (`LOJAS`, `DEMO`) |
| Vitrine | `src/app/loja/[slug]/` (layout, início, categoria, produto, busca, carrinho, checkout, pedido) |
| Componentes da vitrine | `src/components/loja/` (modelo de tema completo: `*Relojoaria.tsx`) |
| Temas | `src/app/globals.css` (`[data-tema="..."]`, `@theme`, `@utility`) |
| Painel | `src/app/admin/(painel)/` e `src/components/admin/` |
| Regras de negócio | `src/lib/` (pedidos, estoque, compras, financeiro, pix, frete, cupom, importacao, catalogo, feed, canais/, marcas) |
| Testes | `tests/unit/` (vitest, banco `lojas_test`) e `tests/e2e/fluxo.spec.ts` (Playwright, banco `lojas_e2e`) |
| Planilha modelo | `dados/colecao-bg.csv` |

## O que o usuário valoriza

Aprendido nas conversas. Siga sem precisar perguntar.

- **Painel enxuto.** Ele comparou com o MarketUP e pediu para "melhorar e enxugar":
  poucas abas, formulários curtos, o essencial à vista.
- **Elegância das grandes marcas, com design próprio.** Para a BG ele mandou Rolex,
  Swatch e Casio como referência. Estude a estrutura (espaço em branco, tipografia fina,
  fotos grandes, seções), mas crie um visual original: nada de logotipos, fotos, textos
  ou nomes dessas marcas.
- **A voz da loja é a do Instagram dele.** Use o slogan e a bio reais (BG: "O tempo
  passa. A presença fica." e "Seu estilo. Sua presença. Seu tempo.").
- **Peças por lote.** O selo "Última unidade" aparece quando o estoque é 1.
- **Coleção própria, sem marcas de terceiros.** Nada de Rolex, Citizen, Omega, TAG Heuer,
  Tiffany, Snoopy, Formula 1, Gucci, Ray-Ban, "réplica" etc. em nomes, descrições, fichas,
  cores ou hashtags. `src/lib/marcas.ts` avisa no painel, tira o produto do feed e
  bloqueia a publicação no Mercado Livre. Se o usuário quiser vender réplica, explique que
  é crime (Lei 9.279/96, arts. 189 e 190) e que Mercado Livre, Shopee, Google, Meta e
  Mercado Pago suspendem a conta e podem reter o dinheiro; ofereça nomes próprios
  (BG Atlântico, BG Clássico...). "Corrente cartier" e "colar ômega" são modelos de
  corrente de semijoia, não marca, e são aceitos.
- **Ver antes de publicar.** Depois de mudar o visual, mostre a prévia (skill
  previa-loja) antes de instalar.

## Fluxo para uma loja nova

1. **Juntar as informações.** Pergunte só o que faltar: nome, slug (sem acento, com
   hífen), segmento, Instagram, slogan e bio, cores, referências de visual, categorias,
   WhatsApp, Pix (chave, nome, cidade), frete (retirada, entrega, grátis acima de),
   desconto no Pix, parcelas sem juros e domínio desejado. Instagram e sites de marcas
   são bloqueados no ambiente: peça prints, o HTML salvo das páginas ou as fotos em JPG.
2. **Cadastrar** em `scripts/seed.ts`, no array `LOJAS` (slug, nome, slogan, sobre,
   corPrimaria, corDestaque, tema, instagram, categorias). O seed cria a loja só se ela
   não existir e nunca altera uma existente: para mudar uma loja que já está no ar, use o
   painel (Configurações) ou uma migração. O `DEMO` é catálogo inventado para testes e
   prévia; em produção o seed roda sem `--demo`.
3. **Tema.** Se `elegante`, `moderno` ou `relojoaria` servem, basta escolher (painel →
   Configurações → Tema). Tema novo:
   - acrescente o nome em `TemaLoja` (`src/db/schema.ts`; a coluna é texto, não precisa
     de migração) e na lista do select de Configurações;
   - crie o bloco `[data-tema="novo"]` em `globals.css` (fontes, cores, botões);
   - nas páginas de `src/app/loja/[slug]/`, ramifique como já é feito para `relojoaria`
     e crie os componentes seguindo `InicioRelojoaria`, `ProdutoRelojoaria`,
     `CabecalhoRelojoaria`, `MenuRelojoaria` e `RodapeRelojoaria`;
   - fontes com `@fontsource` (o Google Fonts é bloqueado no ambiente; o fontsource
     funciona offline e serve as fontes do próprio site).
4. **Catálogo real** por planilha (Produtos → Importar), colunas `nome, marca, categoria,
   variacao, sku, codigo_barras, preco, preco_de, custo, estoque, descricao, ficha,
   garantia, vem_com, ativo`. Linhas com o mesmo nome viram variações; SKU que já existe
   atualiza preço e estoque; `ficha` no formato `Caixa: aço | Vidro: mineral`; peça sem
   preço entra com `ativo` = `nao` (rascunho). Modelo: `dados/colecao-bg.csv`. Garantia
   mínima por lei: 90 dias (CDC).
5. **Canais.** Mercado Livre: `ML_CLIENT_ID`/`ML_CLIENT_SECRET` no `.env` da VPS e
   conectar a conta no painel (Canais). Shopee: `SHOPEE_PARTNER_ID`/`SHOPEE_PARTNER_KEY`
   (precisa de aprovação da Shopee). Google Merchant e catálogo do Instagram: feed em
   `https://<domínio>/feed.xml` (produto sem foto ou que cita outra marca fica de fora).
   Mercado Pago: `MERCADOPAGO_TOKEN_<SLUG>` (slug em maiúsculas, hífen vira `_`).
6. **Testar.**
   ```bash
   cd lojas
   pg_ctlcluster 16 main start   # se o Postgres do ambiente estiver parado
   npx tsc --noEmit && npx vitest run && npm run build && npx playwright test
   ```
   O e2e roda no build de produção (porta 3200) e recria o banco `lojas_e2e` com o
   catálogo de exemplo. Para loja nova, acrescente um teste em `tests/e2e/fluxo.spec.ts`
   (título da abertura, adicionar à sacola, total com Pix).
7. **Mostrar e publicar.** Prévia com a skill previa-loja; com o "ok" do usuário,
   publique com a skill publicar-lojas-vps. A loja nova nasce na subida (seed) e ganha
   endereço com `vps-dominio.sh` (sem domínio ainda: `<nome>.177-153-67-118.sslip.io`).
8. Commit e push na branch que a VPS usa (ver publicar-lojas-vps).

## Armadilhas já resolvidas

- Dependências: `npm install --legacy-peer-deps` (o `.npmrc` já tem a opção).
- Tailwind v4: classes próprias com `@utility`, não `@apply` de classe desconhecida.
- Parar o servidor sem matar o próprio shell:
  `ps -eo pid,args | awk '/next-server|server\.js/ && !/awk/ {print $1}' | xargs -r kill`
  (não use `pkill -f`).
- Build `standalone`: rode `node .next/standalone/server.js` depois de copiar `public` e
  `.next/static` para dentro dele (`next start` reclama).
- Menu em tela cheia dentro de cabeçalho com `backdrop-blur`: use `createPortal`.
- Acentos: a Cormorant Garamond desenha o circunflexo alto demais ("você"); a Playfair
  Display resolve.
- Dinheiro sempre em centavos. Desconto do Pix só no site, com pagamento Pix, depois do
  cupom. Parcela mínima de R$ 20.
- O Postgres do ambiente para quando a sessão reinicia: `pg_ctlcluster 16 main start`.

## Trabalho em equipe

Loja nova é trabalho que se divide bem entre agentes (ver skill equipe-de-agentes):
um agente para cadastro e tema, um para o catálogo (planilha, descrições, regras de
coleção própria), um para os testes. Cada um recebe esta skill, a lista de arquivos que
pode mexer e como provar que terminou. Dois agentes nunca editam o mesmo arquivo.
