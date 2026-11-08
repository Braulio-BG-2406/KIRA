---
name: migrar-site-de-terceiro
description: Traz para a plataforma de lojas do repositório Braulio-BG-2406/KIRA (pasta lojas/, na VPS da Kira) um site de vendas que outra pessoa ou empresa fez e hospeda fora, como foi feito com a Infinite Semijoias (infinitesemijoias.store, sistema Astro de um terceiro). Cobre o diagnóstico do site, o que dá e o que não dá para copiar, o pedido de código, banco e domínio ao terceiro, a leitura do catálogo público (peças, opções, preços, estoque, fotos), a importação com fotos, o visual em tema próprio, as páginas institucionais, os endereços antigos, o app para celular, os testes numa VPS simulada e a troca do domínio. Use quando o usuário disser que um site, loja ou app "está na web de terceiro", "foi feito por outra pessoa", "não está na nossa VPS", pedir para clonar, copiar, trazer ou migrar um site de vendas, ou mandar o link de uma loja dele hospedada em outro lugar.
---

# Migrar um site de vendas feito por terceiro

Caso real (07/11/2026): a Janaina (Infinite Semijoias, CNPJ dela) pagou um terceiro, que
entregou um sistema próprio em Astro, hospedado por ele. Em uma sessão a loja foi refeita
na plataforma `lojas/` com o visual, o catálogo inteiro (469 peças, 424 fotos), as
páginas e o app, e foi ao ar na VPS. O material ficou em `migracao-infinite/`.

## 1. Diagnóstico (só lê)

1. A rede do ambiente bloqueia sites novos. Se `curl` der `CONNECT tunnel failed, 403`,
   use `get_environment` e proponha `update_environment` com o domínio e o `www`
   (é uma necessidade concreta: pedido bloqueado pelo proxy).
2. Leia a página inicial, `robots.txt`, `sitemap.xml` e `manifest.webmanifest`, e os
   cabeçalhos. Procure: gerador (Astro, Next, Shopify, Nuvemshop, Wix, Lovable...),
   rotas fechadas (`/admin`, `/conta`, `/checkout` respondem 302 para login), o JSON-LD
   de produto e como as opções aparecem (na Infinite: `?v=<slug-da-opção>`).
3. Tire prints com Playwright (desktop e celular). Guarde cores (variáveis CSS do
   `global.css`), fontes e textos.
4. Diga ao usuário, em português simples: o que o sistema faz, que "app" quase sempre é
   PWA (site instalado na tela inicial), e o que **não** sai pelo site público: código do
   servidor, banco (clientes, pedidos, revendedoras, avaliações), chaves de pagamento e o
   painel.

## 2. Dois caminhos (apresente os dois)

- **A. Pedir ao terceiro o sistema completo:** código (Git ou .zip), dump do banco e
  pasta de fotos, lista de integrações e o acesso ao registro do domínio **no nome do
  dono**. Há um texto pronto em `migracao-infinite/README.md`.
- **B. Refazer na nossa plataforma** com o conteúdo público. Ganha ERP, estoque,
  marketplaces e API da Kira; perde o que só existia no sistema dele (revenda com
  maleta, contas de cliente, avaliações) até ser refeito.

Na Infinite o usuário escolheu B. Credenciais do painel antigo não são necessárias: se
quiser dados de lá (clientes, pedidos, custo), o dono exporta e salva no Google Drive.
Nunca peça senha no chat.

## 3. Ler o catálogo público

Scripts em `scripts/` (cópias dos usados em `migracao-infinite/scripts/`):

```bash
python3 -I scripts/raspar.py <pasta>          # precisa de <pasta>/urls.txt (do sitemap)
python3 -I scripts/converter.py <pasta>/catalogo.json <saida>.csv <saida>-fotos.json
bash scripts/baixar_fotos.sh <saida>-fotos.json <pasta>/fotos
```

- `raspar.py` lê uma página por vez com pausa (0,4 s), guarda o HTML em `pages/` (pode
  ser interrompido e retomado) e abre cada opção (`?v=`). Ajuste as expressões de
  `ler()` ao HTML do site novo: nome, código e preço vêm do JSON-LD; estoque do
  `data-max`; opções dos links `?v=`; fotos da galeria.
- 469 peças com opções levaram ~35 min. Rode em segundo plano e acompanhe.
- Foto servida como WebP com extensão `.png/.jpg` é comum: confira com `file`.
- Descrição genérica ("Fale com a gente pelo WhatsApp...") vira vazia.
- Nomes repetidos são produtos diferentes: o endereço (slug) do site antigo distingue.
- Código repetido nas opções (Ouro/Ródio com o mesmo SKU): a partir da segunda opção,
  `CODIGO-OPCAO` (ex.: `148381-RODIO`), igual no CSV e no importador.

## 4. Levar para a plataforma

1. **Importar com fotos:** `lojas/scripts/importar-catalogo.ts <slug> <pasta>` lê
   `catalogo/catalogo.json` e `fotos/`; mantém o slug antigo (links do Google continuam
   valendo), a ordem do site vira a data de cadastro (para "Novidades"), cria as coleções
   e os movimentos de estoque. Repetível; `--atualizar` só ajusta preço e estoque.
2. **Visual:** tema próprio em `src/components/loja/*<Tema>.tsx` + bloco no
   `globals.css`, banners/logos em `public/lojas/<slug>/` e em `src/lib/visual.ts`
   (abertura, painéis, dados da empresa, app). O tema `joalheria` é o exemplo completo.
3. **Dados da loja:** migração SQL só para a loja (`drizzle-kit generate --custom`),
   preenchendo contatos com `COALESCE` para não apagar o que já foi ajustado no painel;
   e o mesmo no `scripts/seed.ts` para instalação nova.
4. **Páginas institucionais:** `src/lib/paginas.ts`, reescritas para o nosso sistema
   (sem conta de cliente; pedido acompanhado pelo código; Pix, Mercado Pago ou WhatsApp).
   Cada dado da empresa numa linha: linha sem dado some sozinha.
5. **Endereços antigos:** rotas que redirecionam (`/catalogo/<coleção>`, `/conta`,
   `/catalogo?q=`). Produto mantém `/produto/<slug>`.
6. **App:** `visual.app` (ícones 192/512/maskable/apple/favicon) → manifesto por loja
   e `/sw.js` (sem cache de páginas).
7. **Testes:** `npx tsc --noEmit`, `npx vitest run`, `npm run build`,
   `PW_CHROMIUM=/opt/pw-browsers/chromium npx playwright test` com um teste novo da loja.

## 5. VPS simulada e entrega

Teste a atualização partindo da versão que está no ar: suba a branch antiga, depois a
nova, rode a importação duas vezes e confira tema, fotos (dono dos arquivos), loja
vizinha intacta e domínio próprio (`curl -H "Host: dominio"`). Detalhes do build com
proxy em publicar-lojas-vps ("Problemas já vistos").

Ao usuário, dois comandos (instalador com `RAMO=<branch>` e
`bash scripts/vps-importar-catalogo.sh`) e o que deve aparecer no fim. Depois: Pix e
Mercado Pago no painel, pedido de teste, e só então a troca do domínio (registros A para
o IP da VPS + `vps-dominio.sh`), avisando para recolher antes os pedidos em aberto no
sistema do terceiro.

## Cuidados

- Copiar o conteúdo é do dono (fotos, textos, preços). O código do terceiro não é
  copiado: o site é refeito na plataforma.
- Marcas de terceiros (logo de jogo, de celular, de grife) não entram em logo, ícone ou
  produto: o recorte usa só o letreiro do dono.
- A prévia como link público imita o site de uma empresa real: monte os arquivos e
  pergunte antes de publicar.
- Erro de base que apareceu aqui e vale conferir em qualquer migração: `.gitignore` com
  `uploads/` ignorava `src/app/uploads/` (fotos nunca apareciam no ar).
