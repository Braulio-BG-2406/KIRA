import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, fecharDb } from "@/db";
import { lancamentos, pedidoHistorico, pedidos } from "@/db/schema";
import { criarPedido } from "@/lib/pedidos";
import { criarPreferencia } from "@/lib/mercadopago";
import { POST as webhook } from "@/app/api/pagamentos/mercadopago/[slug]/route";
import { banco, criarLoja, criarProduto } from "./_banco";

const fetchOriginal = globalThis.fetch;

beforeEach(async () => {
  await banco();
  process.env.MERCADOPAGO_TOKEN_TESTE = "TEST-token";
  process.env.APP_URL = "https://lojas.exemplo.com";
});
afterEach(() => {
  globalThis.fetch = fetchOriginal;
  delete process.env.MERCADOPAGO_TOKEN_TESTE;
});
afterAll(fecharDb);

async function pedidoMP() {
  const loja = await criarLoja("teste");
  const { variante } = await criarProduto(loja.id, "Colar", 10000, 5);
  const pedido = await criarPedido({
    lojaId: loja.id,
    canal: "site",
    formaPagamento: "mercadopago",
    cliente: { nome: "Ana", email: "ana@x.com" },
    itens: [{ varianteId: variante.id, quantidade: 1 }],
    entrega: { metodo: "retirada", descricao: "" },
  });
  return { loja, pedido };
}

function avisar(slug: string, id: string) {
  return webhook(
    new Request(`https://lojas.exemplo.com/api/pagamentos/mercadopago/${slug}?data.id=${id}&type=payment`, {
      method: "POST",
      body: JSON.stringify({ type: "payment", data: { id } }),
    }),
    { params: Promise.resolve({ slug }) },
  );
}

function mpResponde(pagamento: object) {
  const fetchFalso = vi.fn(async () => new Response(JSON.stringify(pagamento), { status: 200 }));
  globalThis.fetch = fetchFalso as unknown as typeof fetch;
  return fetchFalso;
}

describe("Mercado Pago", () => {
  it("cria a preferência com o total do pedido e o webhook da loja", async () => {
    const { loja, pedido } = await pedidoMP();
    const fetchFalso = vi.fn(async () => new Response(JSON.stringify({ id: "pref-1", init_point: "https://mp/pagar" }), { status: 201 }));
    globalThis.fetch = fetchFalso as unknown as typeof fetch;
    const r = await criarPreferencia({ loja, pedido, cliente: { nome: "Ana", email: "ana@x.com" }, urlPedido: "https://loja/pedido/X" });
    expect(r).toEqual({ id: "pref-1", link: "https://mp/pagar" });
    const [url, init] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.mercadopago.com/checkout/preferences");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer TEST-token");
    const corpo = JSON.parse(String(init.body));
    expect(corpo.items).toEqual([expect.objectContaining({ quantity: 1, unit_price: 100, currency_id: "BRL" })]);
    expect(corpo.external_reference).toBe(String(pedido.id));
    expect(corpo.notification_url).toBe("https://lojas.exemplo.com/api/pagamentos/mercadopago/teste");
    expect(corpo.auto_return).toBe("approved");
  });

  it("pagamento aprovado marca o pedido como pago", async () => {
    const { pedido } = await pedidoMP();
    const fetchFalso = mpResponde({ id: 555, status: "approved", external_reference: String(pedido.id), transaction_amount: 100 });
    expect((await avisar("teste", "555")).status).toBe(200);
    expect(fetchFalso).toHaveBeenCalledWith("https://api.mercadopago.com/v1/payments/555", expect.anything());
    const [p] = await db.select().from(pedidos).where(eq(pedidos.id, pedido.id));
    expect(p).toMatchObject({ status: "pago", statusPagamento: "aprovado", mpPagamentoId: "555" });
    expect(await db.select().from(lancamentos)).toHaveLength(1);
    // aviso repetido não duplica nada
    await avisar("teste", "555");
    expect(await db.select().from(lancamentos)).toHaveLength(1);
  });

  it("ignora pagamento pendente, de outra loja ou com valor menor", async () => {
    const { pedido } = await pedidoMP();
    mpResponde({ id: 1, status: "pending", external_reference: String(pedido.id), transaction_amount: 100 });
    await avisar("teste", "1");
    mpResponde({ id: 2, status: "approved", external_reference: String(pedido.id), transaction_amount: 100 });
    await avisar("outra-loja", "2");
    mpResponde({ id: 3, status: "approved", external_reference: String(pedido.id), transaction_amount: 1 });
    await avisar("teste", "3");
    const [p] = await db.select().from(pedidos).where(eq(pedidos.id, pedido.id));
    expect(p.statusPagamento).toBe("pendente");
    const hist = await db.select().from(pedidoHistorico).where(eq(pedidoHistorico.pedidoId, pedido.id));
    expect(hist.at(-1)?.nota).toContain("menos que o total");
  });

  it("não consulta o MP com id estranho", async () => {
    await pedidoMP();
    const fetchFalso = mpResponde({});
    await avisar("teste", "../v1/outra-coisa");
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});
