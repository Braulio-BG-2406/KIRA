import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, fecharDb } from "@/db";
import { lojas, produtoImagens, produtos, variantes } from "@/db/schema";
import { gerarFeed, gerarSitemap, gtinValido } from "@/lib/feed";
import { legendaInstagram } from "@/lib/divulgacao";
import { produtoPorSlug } from "@/lib/catalogo";
import { rastreamentoSeguro } from "@/lib/rastreamento";
import { importarProdutos, lerFicha } from "@/lib/importacao";
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

describe("coleção própria", () => {
  it("deixa fora do feed o produto que cita outra marca", async () => {
    const loja = await criarLoja("bg");
    const proprio = await criarProduto(loja.id, "BG Atlântico", 25999, 1);
    const citando = await criarProduto(loja.id, "Relógio Clássico", 22990, 2);
    await db.update(variantes).set({ nome: "Azul Tiffany" }).where(eq(variantes.id, citando.variante.id));
    for (const { produto } of [proprio, citando]) await db.insert(produtoImagens).values({ produtoId: produto.id, url: "/uploads/foto.jpg" });

    const xml = await gerarFeed((await db.select().from(lojas).where(eq(lojas.id, loja.id)))[0]);
    expect(xml).toContain("<g:title>BG Atlântico</g:title>");
    expect(xml).not.toContain("Clássico");
  });

  it("importa ficha técnica, garantia e peça sem preço como rascunho", async () => {
    expect(lerFicha("Caixa: 42 mm | Vidro: mineral | sem valor | Data:")).toEqual([
      { nome: "Caixa", valor: "42 mm" },
      { nome: "Vidro", valor: "mineral" },
    ]);
    const loja = await criarLoja("bg");
    const csv = [
      "nome;categoria;variacao;sku;preco;estoque;ficha;garantia;vem_com;ativo",
      "BG Clássico;Relógios;Verde Esmeralda;CLA-VE;229,90;2;Caixa: aço | Mostrador: sunburst;90 dias;Estojo;sim",
      "BG Clássico;Relógios;Azul Celeste;CLA-AC;229,90;1;;;;sim",
      "BG Pista;Relógios;Padrão;PIS-01;;5;Bisel: serrilhado;;;nao",
      "BG Lunar;Relógios;Padrão;LUN-01;;1;;;;sim",
      "BG Clássico;Relógios;Prata;CLA-PR;;1;;;;nao",
    ].join("\n");
    const r = await importarProdutos(loja.id, csv);
    expect(r.criados).toBe(3);
    expect(r.erros).toEqual(["Linha 5: falta nome ou preço.", "Linha 6: falta o preço (o produto já está à venda)."]);

    const lista = await db.select().from(produtos).where(eq(produtos.lojaId, loja.id));
    const classico = lista.find((p) => p.nome === "BG Clássico")!;
    expect(classico.especificacoes).toEqual([{ nome: "Caixa", valor: "aço" }, { nome: "Mostrador", valor: "sunburst" }]);
    expect(classico.garantia).toBe("90 dias");
    expect(classico.itensInclusos).toBe("Estojo");
    expect(classico.ativo).toBe(true);
    const pista = lista.find((p) => p.nome === "BG Pista")!;
    expect(pista.ativo).toBe(false);
    const [vPista] = await db.select().from(variantes).where(eq(variantes.produtoId, pista.id));
    expect(vPista.precoCentavos).toBe(0);
    expect(vPista.estoque).toBe(5);
  });
});
