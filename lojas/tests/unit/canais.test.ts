import { createHmac } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, fecharDb } from "@/db";
import { anuncios, canais, lancamentos, pedidos, variantes, CONFIG_CANAL_PADRAO, type Canal } from "@/db/schema";
import { importarPedido, receberAvisoDePedido, sincronizarCanal, vincularAnuncio } from "@/lib/canais/sincronizar";
import { avisoShopeeValido, shopee } from "@/lib/canais/shopee";
import { banco, criarLoja, criarProduto } from "./_banco";

type Chamada = { metodo: string; url: string; corpo: unknown };
let chamadas: Chamada[] = [];
const fetchOriginal = globalThis.fetch;

/** responde conforme o começo da URL */
function simularApi(rotas: Record<string, (c: Chamada) => unknown>) {
  globalThis.fetch = vi.fn(async (entrada: string | URL | Request, init?: RequestInit) => {
    const url = String(entrada);
    const metodo = init?.method ?? "GET";
    let corpo: unknown = init?.body;
    if (typeof corpo === "string") {
      try {
        corpo = JSON.parse(corpo);
      } catch {}
    }
    const c = { metodo, url, corpo };
    chamadas.push(c);
    const chave = Object.keys(rotas).find((k) => `${metodo} ${url}`.startsWith(k));
    if (!chave) return new Response(JSON.stringify({ message: "rota não simulada" }), { status: 404 });
    return new Response(JSON.stringify(rotas[chave](c)), { status: 200 });
  }) as unknown as typeof fetch;
}

const futuro = () => new Date(Date.now() + 3600_000).toISOString();

async function criarCanal(lojaId: number, tipo: "mercadolivre" | "shopee", expiraEm = futuro()): Promise<Canal> {
  const [c] = await db
    .insert(canais)
    .values({ lojaId, tipo, config: CONFIG_CANAL_PADRAO, credenciais: { accessToken: "TOKEN", refreshToken: "REFRESH", expiraEm, contaId: "999" } })
    .returning();
  return c;
}

async function estoque(id: number) {
  return (await db.select().from(variantes).where(eq(variantes.id, id)))[0].estoque;
}

beforeEach(async () => {
  await banco();
  chamadas = [];
  process.env.ML_CLIENT_ID = "app";
  process.env.ML_CLIENT_SECRET = "segredo";
  process.env.SHOPEE_PARTNER_ID = "1001";
  process.env.SHOPEE_PARTNER_KEY = "chave-shopee";
});
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});
afterAll(fecharDb);

const pedidoML = (status: string, itens = [{ item: { id: "MLB1", title: "Relógio", variation_id: null, seller_sku: null }, quantity: 2, unit_price: 150.5 }]) => ({
  id: 2000001,
  status,
  buyer: { nickname: "COMPRADOR1", first_name: "João", last_name: "Silva" },
  order_items: itens,
});

describe("Mercado Livre", () => {
  it("pedido pago vira venda na loja, baixa estoque e o estoque novo volta para o ML", async () => {
    const loja = await criarLoja();
    const { variante } = await criarProduto(loja.id, "Relógio", 10000, 5);
    const canal = await criarCanal(loja.id, "mercadolivre");
    await vincularAnuncio(canal, variante.id, "MLB1");
    simularApi({
      "GET https://api.mercadolibre.com/orders/2000001": () => pedidoML("paid"),
      "PUT https://api.mercadolibre.com/items/MLB1": () => ({}),
    });

    expect(await receberAvisoDePedido(canal, "2000001")).toBe("criado");
    const [p] = await db.select().from(pedidos);
    expect(p).toMatchObject({ canal: "mercadolivre", canalPedidoId: "2000001", status: "pago", formaPagamento: "marketplace", totalCentavos: 30100, freteCentavos: 0 });
    expect(await estoque(variante.id)).toBe(3);
    expect(await db.select().from(lancamentos)).toHaveLength(1);
    const put = chamadas.find((c) => c.metodo === "PUT")!;
    expect(put.corpo).toEqual({ available_quantity: 3, price: 100 });
    expect(chamadas[0].url).toContain("/orders/2000001");

    // aviso repetido não duplica
    expect(await receberAvisoDePedido(canal, "2000001")).toBe("ignorado");
    expect(await db.select().from(pedidos)).toHaveLength(1);
  });

  it("pedido cancelado no ML cancela na loja e devolve o estoque", async () => {
    const loja = await criarLoja();
    const { variante } = await criarProduto(loja.id, "Relógio", 10000, 5);
    const canal = await criarCanal(loja.id, "mercadolivre");
    await vincularAnuncio(canal, variante.id, "MLB1");
    await importarPedido(canal, { id: "7", status: "pago", comprador: { nome: "Ana" }, itens: [{ externoId: "MLB1", externoVarianteId: "", titulo: "x", quantidade: 1, precoUnitCentavos: 10000 }] });
    expect(await estoque(variante.id)).toBe(4);
    expect(await importarPedido(canal, { id: "7", status: "cancelado", comprador: { nome: "Ana" }, itens: [] })).toBe("cancelado");
    expect(await estoque(variante.id)).toBe(5);
    expect((await db.select().from(pedidos))[0].status).toBe("cancelado");
  });

  it("acha o produto pelo SKU quando o anúncio não está vinculado, e avisa quando não acha", async () => {
    const loja = await criarLoja();
    const { variante } = await criarProduto(loja.id, "Carteira", 8990, 4);
    await db.update(variantes).set({ sku: "CART-01" }).where(eq(variantes.id, variante.id));
    const canal = await criarCanal(loja.id, "mercadolivre");
    const item = (sku: string | null) => ({ externoId: "MLB9", externoVarianteId: "", sku, titulo: "Carteira", quantidade: 1, precoUnitCentavos: 9500 });
    expect(await importarPedido(canal, { id: "1", status: "pago", comprador: { nome: "A" }, itens: [item("CART-01")] })).toBe("criado");
    expect(await estoque(variante.id)).toBe(3);
    expect(await importarPedido(canal, { id: "2", status: "pago", comprador: { nome: "B" }, itens: [item("OUTRO")] })).toBe("ignorado");
    const [c] = await db.select().from(canais);
    expect(c.ultimoErro).toContain("sem vínculo");
  });

  it("vende mesmo sem estoque no sistema e registra o aviso", async () => {
    const loja = await criarLoja();
    const { variante } = await criarProduto(loja.id, "Óculos", 14990, 0);
    const canal = await criarCanal(loja.id, "mercadolivre");
    await vincularAnuncio(canal, variante.id, "MLB5");
    await importarPedido(canal, { id: "3", status: "pago", comprador: { nome: "C" }, itens: [{ externoId: "MLB5", externoVarianteId: "", titulo: "x", quantidade: 1, precoUnitCentavos: 14990 }] });
    expect(await estoque(variante.id)).toBe(-1);
  });

  it("só manda o que mudou, aplica o acréscimo e guarda o erro do anúncio", async () => {
    const loja = await criarLoja();
    const { variante } = await criarProduto(loja.id, "Cinto", 10000, 5);
    const canal = await criarCanal(loja.id, "mercadolivre");
    await db.update(canais).set({ config: { ...CONFIG_CANAL_PADRAO, acrescimoPct: 15 } }).where(eq(canais.id, canal.id));
    canal.config.acrescimoPct = 15;
    await vincularAnuncio(canal, variante.id, "MLB2");
    simularApi({ "PUT https://api.mercadolibre.com/items/MLB2": () => ({}) });

    expect(await sincronizarCanal(canal)).toEqual({ enviados: 1, erros: 0 });
    expect(chamadas[0].corpo).toEqual({ available_quantity: 5, price: 115 });
    expect(await sincronizarCanal(canal)).toEqual({ enviados: 0, erros: 0 });

    await db.update(variantes).set({ estoque: 2 }).where(eq(variantes.id, variante.id));
    simularApi({});
    expect(await sincronizarCanal(canal)).toEqual({ enviados: 0, erros: 1 });
    const [a] = await db.select().from(anuncios);
    expect(a.erro).toContain("Mercado Livre recusou");
    expect(a.ultimoEstoqueEnviado).toBe(5);
  });

  it("anúncio com variação manda só o estoque da variação", async () => {
    const loja = await criarLoja();
    const { variante } = await criarProduto(loja.id, "Relógio", 10000, 7);
    const canal = await criarCanal(loja.id, "mercadolivre");
    await vincularAnuncio(canal, variante.id, "MLB3", "175000");
    simularApi({ "PUT https://api.mercadolibre.com/items/MLB3": () => ({}) });
    await sincronizarCanal(canal);
    expect(chamadas[0].corpo).toEqual({ variations: [{ id: 175000, available_quantity: 7 }] });
  });

  it("renova o token vencido antes de chamar", async () => {
    const loja = await criarLoja();
    const { variante } = await criarProduto(loja.id, "Relógio", 10000, 1);
    const canal = await criarCanal(loja.id, "mercadolivre", new Date(Date.now() - 1000).toISOString());
    await vincularAnuncio(canal, variante.id, "MLB4");
    simularApi({
      "POST https://api.mercadolibre.com/oauth/token": () => ({ access_token: "NOVO", refresh_token: "REFRESH2", expires_in: 21600, user_id: 999 }),
      "PUT https://api.mercadolibre.com/items/MLB4": () => ({}),
    });
    await sincronizarCanal(canal);
    expect(String(chamadas[0].corpo)).toContain("grant_type=refresh_token");
    expect(String(chamadas[0].corpo)).toContain("refresh_token=REFRESH");
    const [c] = await db.select().from(canais);
    expect(c.credenciais).toMatchObject({ accessToken: "NOVO", refreshToken: "REFRESH2" });
  });
});

describe("Shopee", () => {
  it("assina a chamada e manda o estoque do modelo", async () => {
    const loja = await criarLoja();
    const { variante } = await criarProduto(loja.id, "Relógio", 25000, 4);
    const canal = await criarCanal(loja.id, "shopee");
    await db.update(canais).set({ config: { ...CONFIG_CANAL_PADRAO, sincronizarPreco: false } }).where(eq(canais.id, canal.id));
    canal.config.sincronizarPreco = false;
    await vincularAnuncio(canal, variante.id, "555", "777");
    simularApi({ "POST https://partner.shopeemobile.com/api/v2/product/update_stock": () => ({ response: {} }) });
    await sincronizarCanal(canal);
    expect(chamadas).toHaveLength(1);
    const url = new URL(chamadas[0].url);
    const ts = url.searchParams.get("timestamp");
    const esperado = createHmac("sha256", "chave-shopee").update(`1001/api/v2/product/update_stock${ts}TOKEN999`).digest("hex");
    expect(url.searchParams.get("sign")).toBe(esperado);
    expect(url.searchParams.get("shop_id")).toBe("999");
    expect(chamadas[0].corpo).toEqual({ item_id: 555, stock_list: [{ model_id: 777, seller_stock: [{ stock: 4 }] }] });
  });

  it("traduz o pedido da Shopee e confere a assinatura do aviso", async () => {
    const loja = await criarLoja();
    const canal = await criarCanal(loja.id, "shopee");
    simularApi({
      "GET https://partner.shopeemobile.com/api/v2/order/get_order_detail": () => ({
        response: {
          order_list: [
            {
              order_sn: "2410ABC",
              order_status: "READY_TO_SHIP",
              buyer_username: "comprador",
              recipient_address: { name: "Carlos", phone: "5511999990000", full_address: "Rua A, 1" },
              item_list: [{ item_id: 555, model_id: 777, item_name: "Relógio", model_name: "Preto", model_sku: "REL-P", model_quantity_purchased: 1, model_discounted_price: 239.9 }],
            },
          ],
        },
      }),
    });
    const pe = await shopee.buscarPedido(canal, "2410ABC");
    expect(pe).toMatchObject({
      id: "2410ABC",
      status: "pago",
      comprador: { nome: "Carlos" },
      itens: [{ externoId: "555", externoVarianteId: "777", sku: "REL-P", quantidade: 1, precoUnitCentavos: 23990 }],
    });
    const corpo = '{"code":3,"shop_id":999}';
    const url = "https://painel.exemplo.com/api/canais/shopee/notificacoes";
    const assinatura = createHmac("sha256", "chave-shopee").update(`${url}|${corpo}`).digest("hex");
    expect(avisoShopeeValido(url, corpo, assinatura)).toBe(true);
    expect(avisoShopeeValido(url, corpo, "falsa")).toBe(false);
    expect(avisoShopeeValido(url, corpo + " ", assinatura)).toBe(false);
  });
});
