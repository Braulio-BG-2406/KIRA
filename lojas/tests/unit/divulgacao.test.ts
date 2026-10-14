import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, fecharDb } from "@/db";
import { lojas, produtoImagens, produtos, variantes } from "@/db/schema";
import { gerarFeed, gerarSitemap, gtinValido } from "@/lib/feed";
import { legendaInstagram } from "@/lib/divulgacao";
import { produtoPorSlug } from "@/lib/catalogo";
import { rastreamentoSeguro } from "@/lib/rastreamento";
import { banco, criarLoja, criarProduto } from "./_banco";

beforeEach(async () => {
  await banco();
  process.env.APP_URL = "https://painel.exemplo.com";
});
afterAll(fecharDb);

describe("feed do Google e da Meta", () => {
  it("valida GTIN pelo dígito verificador", () => {
    expect(gtinValido("7891234567895")).toBe(true);
    expect(gtinValido("7891234567890")).toBe(false);
    expect(gtinValido("123")).toBe(false);
    expect(gtinValido(null)).toBe(false);
  });

  it("lista cada variação com foto, preço, estoque e marca, e deixa de fora produto sem foto", async () => {
    const loja = await criarLoja("bg");
    const { produto, variante } = await criarProduto(loja.id, "Relogio Cronografo", 38990, 3);
    await db.update(produtos).set({ marca: "BG Collection", descricao: "Aço & couro <top>" }).where(eq(produtos.id, produto.id));
    await db.update(variantes).set({ precoDeCentavos: 45990, codigoBarras: "7891234567895", nome: "Preto" }).where(eq(variantes.id, variante.id));
    await db.insert(variantes).values({ produtoId: produto.id, nome: "Prata", precoCentavos: 38990, estoque: 0, sku: "CRO-PRATA" });
    await db.insert(produtoImagens).values({ produtoId: produto.id, url: "/uploads/foto.jpg" });
    await criarProduto(loja.id, "Sem Foto", 1000, 5);

    const xml = await gerarFeed((await db.select().from(lojas).where(eq(lojas.id, loja.id)))[0]);
    expect(xml.match(/<item>/g)).toHaveLength(2);
    expect(xml).toContain("<g:title>Relogio Cronografo - Preto</g:title>");
    expect(xml).toContain("<g:price>459.90 BRL</g:price>");
    expect(xml).toContain("<g:sale_price>389.90 BRL</g:sale_price>");
    expect(xml).toContain("<g:gtin>7891234567895</g:gtin>");
    expect(xml).toContain("<g:brand>BG Collection</g:brand>");
    expect(xml).toContain("<g:image_link>https://painel.exemplo.com/uploads/foto.jpg</g:image_link>");
    expect(xml).toContain("<g:availability>out_of_stock</g:availability>");
    expect(xml).toContain("<g:mpn>CRO-PRATA</g:mpn>");
    expect(xml).toContain(`<g:item_group_id>P${produto.id}</g:item_group_id>`);
    expect(xml).toContain("Aço &amp; couro &lt;top&gt;");
    expect(xml).not.toContain("Sem Foto");
    expect(xml).toContain("<g:link>https://painel.exemplo.com/loja/bg/produto/relogio-cronografo</g:link>");
  });

  it("sitemap traz só produto à venda", async () => {
    const loja = await criarLoja("bg");
    await criarProduto(loja.id, "Visivel", 1000, 1);
    const { produto } = await criarProduto(loja.id, "Oculto", 1000, 1);
    await db.update(produtos).set({ ativo: false }).where(eq(produtos.id, produto.id));
    const xml = await gerarSitemap(loja);
    expect(xml).toContain("/produto/visivel");
    expect(xml).not.toContain("/produto/oculto");
  });
});

describe("divulgação", () => {
  it("monta a legenda com preço, Pix, parcelas e hashtags", async () => {
    const loja = await criarLoja("bg");
    const { produto } = await criarProduto(loja.id, "Relógio Minimalista Couro", 24990, 5);
    await db.update(produtos).set({ marca: "BG Collection", descricao: "Mostrador limpo. Caixa fina.", garantia: "12 meses" }).where(eq(produtos.id, produto.id));
    const p = (await produtoPorSlug(loja.id, produto.slug))!;
    // o real formatado usa espaço não separável depois do R$
    const legenda = legendaInstagram({ nome: "BG Imports", descontoPixPct: 5, parcelasSemJuros: 6, whatsapp: "11999999999" }, p, "https://bg.com.br/produto/x", "Relógios").replace(/\u00a0/g, " ");
    expect(legenda).toContain("Relógio Minimalista Couro · BG Collection");
    expect(legenda).toContain("Mostrador limpo.");
    expect(legenda).not.toContain("Caixa fina");
    expect(legenda).toContain("R$ 237,40 no Pix");
    expect(legenda).toContain("6x de R$ 41,65 sem juros");
    expect(legenda).toContain("Garantia: 12 meses");
    expect(legenda).toContain("#bgimports #relogios #bgcollection #relogio");
  });

  it("só aceita códigos de rastreamento no formato certo", () => {
    expect(rastreamentoSeguro({ googleAnalytics: "G-ABC123", metaPixel: "1234567890", googleVerificacao: "abc');alert(1)//" })).toEqual({
      googleAnalytics: "G-ABC123",
      metaPixel: "1234567890",
      googleVerificacao: undefined,
      metaVerificacao: undefined,
    });
  });
});
