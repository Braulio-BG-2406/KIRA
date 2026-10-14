import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categorias, produtos, type Loja } from "@/db/schema";
import { listarVitrine } from "./catalogo";
import { absoluta, urlDaLoja } from "./dominios";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

const reais = (centavos: number) => `${(centavos / 100).toFixed(2)} BRL`;

/** GTIN/EAN válido: 8, 12, 13 ou 14 dígitos com dígito verificador certo */
export function gtinValido(codigo: string | null | undefined): boolean {
  if (!codigo || !/^(\d{8}|\d{12,14})$/.test(codigo)) return false;
  const digitos = codigo.split("").map(Number);
  const verificador = digitos.pop()!;
  const soma = digitos.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (soma % 10)) % 10 === verificador;
}

/**
 * Feed de produtos no formato do Google Merchant Center (RSS 2.0 + g:).
 * O Commerce Manager da Meta (catálogo do Instagram e do Facebook) lê o mesmo arquivo.
 */
export async function gerarFeed(loja: Loja): Promise<string> {
  const [lista, cats] = await Promise.all([
    listarVitrine({ lojaId: loja.id, limite: 5000 }),
    db.select().from(categorias).where(eq(categorias.lojaId, loja.id)).orderBy(asc(categorias.ordem)),
  ]);
  const base = urlDaLoja(loja.slug);
  const itens: string[] = [];
  for (const p of lista) {
    if (p.imagens.length === 0) continue; // Google e Meta recusam produto sem foto
    const varias = p.variantes.length > 1;
    const categoria = cats.find((c) => c.id === p.categoriaId)?.nome;
    for (const v of p.variantes) {
      const titulo = varias ? `${p.nome} - ${v.nome}` : p.nome;
      const descricao = [p.descricao, ...p.especificacoes.map((e) => `${e.nome}: ${e.valor}`)].filter(Boolean).join(". ") || p.nome;
      const temGtin = gtinValido(v.codigoBarras);
      const campos: [string, string | undefined][] = [
        ["g:id", v.sku || `V${v.id}`],
        ["g:item_group_id", varias ? `P${p.id}` : undefined],
        ["g:title", titulo.slice(0, 150)],
        ["g:description", descricao.slice(0, 5000)],
        ["g:link", `${base}/produto/${p.slug}`],
        ["g:image_link", absoluta(p.imagens[0])],
        ...p.imagens.slice(1, 10).map((i) => ["g:additional_image_link", absoluta(i)] as [string, string]),
        ["g:availability", v.estoque > 0 ? "in_stock" : "out_of_stock"],
        // com preço "de", o Google mostra o preço cheio riscado e a oferta
        ["g:price", reais(v.precoDeCentavos && v.precoDeCentavos > v.precoCentavos ? v.precoDeCentavos : v.precoCentavos)],
        ["g:sale_price", v.precoDeCentavos && v.precoDeCentavos > v.precoCentavos ? reais(v.precoCentavos) : undefined],
        ["g:condition", "new"],
        ["g:brand", p.marca || loja.nome],
        ["g:gtin", temGtin ? v.codigoBarras! : undefined],
        ["g:mpn", !temGtin && v.sku ? v.sku : undefined],
        ["g:identifier_exists", !temGtin && !v.sku ? "no" : undefined],
        ["g:product_type", categoria],
      ];
      itens.push(
        "    <item>\n" +
          campos
            .filter(([, valor]) => valor)
            .map(([tag, valor]) => `      <${tag}>${esc(valor!)}</${tag}>`)
            .join("\n") +
          "\n    </item>",
      );
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${esc(loja.nome)}</title>
    <link>${esc(base)}</link>
    <description>${esc(loja.slogan ?? loja.nome)}</description>
${itens.join("\n")}
  </channel>
</rss>
`;
}

export async function gerarSitemap(loja: Loja): Promise<string> {
  const base = urlDaLoja(loja.slug);
  const [lista, cats] = await Promise.all([
    db.select({ slug: produtos.slug, atualizadoEm: produtos.atualizadoEm, ativo: produtos.ativo }).from(produtos).where(eq(produtos.lojaId, loja.id)),
    db.select().from(categorias).where(eq(categorias.lojaId, loja.id)),
  ]);
  const urls = [
    `  <url><loc>${esc(base)}</loc><changefreq>daily</changefreq></url>`,
    ...cats.map((c) => `  <url><loc>${esc(`${base}/categoria/${c.slug}`)}</loc><changefreq>weekly</changefreq></url>`),
    ...lista
      .filter((p) => p.ativo)
      .map((p) => `  <url><loc>${esc(`${base}/produto/${p.slug}`)}</loc><lastmod>${p.atualizadoEm.toISOString().slice(0, 10)}</lastmod></url>`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
}
