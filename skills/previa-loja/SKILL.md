---
name: previa-loja
description: Publica uma prévia navegável do site das lojas (plataforma lojas/ do repositório Braulio-BG-2406/KIRA - BG Imports, Infinite Semijoias e outras) como Artifact privado no claude.ai, para o usuário ver como ficou antes de colocar no ar, ou conferir mudanças de visual e catálogo sem mexer na VPS. Monta o site de produção localmente com o catálogo de exemplo, copia início, coleções e produtos de cada loja sem o JavaScript do Next, embute as fontes e publica tudo junto, com menu funcionando e avisos onde a compra fica desligada. Use quando o usuário pedir para ver como vai ficar, publicar ou mostrar uma prévia, mandar o link do site antes de existir domínio, ou conferir uma mudança de layout, tema ou produtos.
---

# Prévia das lojas no claude.ai

A prévia é uma cópia estática do site de verdade: o mesmo HTML e CSS que o build de
produção gera, sem o JavaScript do Next (que não roda dentro do Artifact). O script
`scripts/montar_previa.py` faz o trabalho pesado:

- percorre início, coleções e produtos de cada loja a partir do servidor local;
- tira os scripts, troca os links por arquivos locais e embute as fontes latinas num
  `site.css` único (fontes de outros alfabetos ficam de fora para caber);
- acrescenta uma faixa "Prévia do site da ... · compra desligada", com link para as
  outras lojas, um menu simples com as coleções e avisos quando alguém clica em sacola,
  busca, WhatsApp ou comprar (o WhatsApp do catálogo de exemplo é falso);
- grava `files.json`, o mapa pronto para o parâmetro `files` do Artifact.

O que funciona na prévia: layout no computador e no celular, menu, coleções, páginas de
produto com ficha técnica, preços com Pix e parcelas, carrosséis (rolagem nativa) e as
seções que abrem e fecham (`<details>`). O que não funciona: sacola, checkout, busca,
login, escolha de variação.

## Passo a passo

1. **Banco com o catálogo certo.** Para o catálogo de exemplo (padrão, sem dados de
   clientes):
   ```bash
   cd /home/user/KIRA/lojas
   pg_lsclusters | grep -q online || pg_ctlcluster 16 main start
   npx tsx -e 'import p from "./tests/e2e/preparar.ts"; p()'
   ```
   Isso recria o banco `lojas_e2e` com as lojas e os produtos de `scripts/seed.ts`
   (`--demo`). Nunca monte a prévia a partir do banco de produção: ela fica num link e
   não deve mostrar pedidos ou clientes.
2. **Build e servidor de produção** (porta 3100):
   ```bash
   npm run build
   cp -r public .next/standalone/ 2>/dev/null; cp -r .next/static .next/standalone/.next/
   DATABASE_URL=postgres://lojas:lojas@localhost:5432/lojas_e2e APP_URL=http://localhost:3100 PORT=3100 HOSTNAME=127.0.0.1 nohup node .next/standalone/server.js > /tmp/servidor-previa.log 2>&1 &
   ```
   Espere `curl -s --noproxy '*' http://127.0.0.1:3100/loja/bg-imports` responder.
3. **Montar a prévia** (a primeira `--loja` vira a página principal):
   ```bash
   env HTTPS_PROXY= HTTP_PROXY= python3 -I <esta skill>/scripts/montar_previa.py \
     --saida <scratchpad>/previa/site --loja bg-imports --loja infinite
   ```
   `--aviso ""` tira o "catálogo de exemplo" da faixa (use quando o catálogo for o real).
4. **Conferir uma vez** (opcional): screenshot com Playwright, no computador (1280 px) e
   no celular (390 px). Para abrir o `index.html` localmente, ponha `<!doctype html>`,
   `<meta charset>` e `<meta viewport>` em volta numa cópia temporária, porque o
   `index.html` não tem esqueleto: o Artifact põe o dele.
5. **Publicar.** Carregue antes a skill `artifact-design` (regra do Artifact). Depois:
   - Artifact com `file_path` = `.../site/index.html`, `root` = `.../site`, `files` =
     o conteúdo de `files.json`;
   - na primeira publicação, `icon` (ex.: `watch` para relojoaria, `shop` para outras);
   - `description` em uma frase (ex.: "Prévia navegável do site da BG Imports e da
     Infinite Semijoias, com o catálogo de exemplo e a compra desligada.").
   O título vem do `<title>` (nome da loja principal). O link é privado: só o dono
   abre; para mostrar a alguém, ele usa o menu Compartilhar da própria página.
6. **Atualizar a mesma prévia.** Na mesma conversa, publique de novo o mesmo
   `file_path`. Em outra conversa, passe o `url` da prévia existente e leia antes
   (`action: "read"`). A prévia já publicada das duas lojas é
   `https://claude.ai/artifact/JKJnc7SgkzW6DNRpXt7c9t`.
7. **Desligar o servidor**:
   `ps -eo pid,args | awk '/next-server|server\.js/ && !/awk/ {print $1}' | xargs -r kill`
   (não use `pkill -f`, que derruba o próprio shell).

## Ao apresentar ao usuário

Diga em poucas linhas: o link; que é só para ver (compra desligada, produtos e preços de
exemplo, ainda sem fotos se for o caso); que é privado e como compartilhar; e que, para
ficar no ar de verdade, o caminho é a skill publicar-lojas-vps.

## Problemas já vistos

| O que aparece | O que fazer |
|---|---|
| Página inteira em fonte do sistema | O `site.css` não carregou: confira se `site.css` está em `files` |
| Menu abre com outra fonte | O script decide a fonte pelo `data-tema` da página; tema novo precisa de regra em `.previa-menu` no script |
| "Ainda há referências a /_next" no fim do script | Algum recurso novo (imagem do Next, por exemplo) não foi trocado; ajuste a função `transformar` |
| `urlopen` recusado | Rode com `env HTTPS_PROXY= HTTP_PROXY=` (o proxy do ambiente não alcança o localhost) |
