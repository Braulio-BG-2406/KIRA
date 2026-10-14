import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, fecharDb } from "@/db";
import { cupons, lancamentos, movimentosEstoque, pedidos, variantes, clientes, pedidoHistorico } from "@/db/schema";
import { avancarStatus, cancelarPedido, cancelarPedidosVencidos, criarPedido, marcarComoPago, ErroNegocio, type NovoPedido } from "@/lib/pedidos";
import { ajustarEstoque } from "@/lib/estoque";
import { criarCompra, receberCompra } from "@/lib/compras";
import { resumoDoMes, criarLancamento } from "@/lib/financeiro";
import { hojeSP } from "@/lib/datas";
import { banco, criarLoja, criarProduto } from "./_banco";

const endereco = { cep: "01001000", logradouro: "Praça da Sé", numero: "1", bairro: "Sé", cidade: "São Paulo", uf: "SP" };

function pedidoSite(lojaId: number, itens: NovoPedido["itens"], extra: Partial<NovoPedido> = {}): NovoPedido {
  return {
    lojaId,
    cliente: { nome: "Maria", email: "Maria@Email.com", telefone: "(11) 99999-0000" },
    itens,
    entrega: { metodo: "entrega", descricao: "", endereco },
    formaPagamento: "pix",
    canal: "site",
    ...extra,
  };
}

async function estoque(varianteId: number) {
  const [v] = await db.select().from(variantes).where(eq(variantes.id, varianteId));
  return v.estoque;
}

beforeEach(banco);
afterAll(fecharDb);

describe("criarPedido", () => {
  it("baixa o estoque, calcula frete pela UF e numera por loja", async () => {
    const loja = await criarLoja();
    const { variante } = await criarProduto(loja.id, "Brinco Gota", 8990, 5);
    const pedido = await criarPedido(pedidoSite(loja.id, [{ varianteId: variante.id, quantidade: 2 }]));
    expect(pedido).toMatchObject({ numero: 1, subtotalCentavos: 17980, freteCentavos: 1000, totalCentavos: 18980, status: "aguardando_pagamento" });
    expect(await estoque(variante.id)).toBe(3);
    const movs = await db.select().from(movimentosEstoque).where(eq(movimentosEstoque.pedidoId, pedido.id));
    expect(movs.map((m) => m.quantidade)).toEqual([-2]);
    const segundo = await criarPedido(pedidoSite(loja.id, [{ varianteId: variante.id, quantidade: 1 }]));
    expect(segundo.numero).toBe(2);
    // o mesmo e-mail reaproveita o cliente
    expect(await db.select().from(clientes)).toHaveLength(1);
  });

  it("recusa quando falta estoque e não deixa nada pela metade", async () => {
    const loja = await criarLoja();
    const a = await criarProduto(loja.id, "Colar", 10000, 5);
    const b = await criarProduto(loja.id, "Anel", 5000, 1);
    await expect(
      criarPedido(pedidoSite(loja.id, [{ varianteId: a.variante.id, quantidade: 1 }, { varianteId: b.variante.id, quantidade: 2 }])),
    ).rejects.toThrow(ErroNegocio);
    expect(await estoque(a.variante.id)).toBe(5);
    expect(await db.select().from(pedidos)).toHaveLength(0);
  });

  it("ignora preço vindo do site e aceita no painel", async () => {
    const loja = await criarLoja();
    const { variante } = await criarProduto(loja.id, "Pulseira", 10000, 5);
    const site = await criarPedido(pedidoSite(loja.id, [{ varianteId: variante.id, quantidade: 1, precoUnitCentavos: 1 }]));
    expect(site.subtotalCentavos).toBe(10000);
    const painel = await criarPedido({
      ...pedidoSite(loja.id, [{ varianteId: variante.id, quantidade: 1, precoUnitCentavos: 8000 }]),
      canal: "whatsapp",
      freteManualCentavos: 0,
      jaPago: true,
      formaPagamento: "dinheiro",
    });
    expect(painel).toMatchObject({ subtotalCentavos: 8000, totalCentavos: 8000, status: "pago" });
    const [receita] = await db.select().from(lancamentos).where(eq(lancamentos.pedidoId, painel.id));
    expect(receita).toMatchObject({ tipo: "receita", status: "pago", valorCentavos: 8000 });
  });

  it("aplica cupom, conta o uso e dá frete grátis acima do mínimo", async () => {
    const loja = await criarLoja();
    const { variante } = await criarProduto(loja.id, "Conjunto", 35000, 5);
    await db.insert(cupons).values({ lojaId: loja.id, codigo: "DEZ", tipo: "percentual", valor: 10, limiteUsos: 1 });
    const pedido = await criarPedido(pedidoSite(loja.id, [{ varianteId: variante.id, quantidade: 1 }], { cupomCodigo: "dez" }));
    expect(pedido).toMatchObject({ descontoCentavos: 3500, freteCentavos: 0, totalCentavos: 31500, cupomCodigo: "DEZ" });
    await expect(criarPedido(pedidoSite(loja.id, [{ varianteId: variante.id, quantidade: 1 }], { cupomCodigo: "DEZ" }))).rejects.toThrow(
      "todo usado",
    );
  });

  it("não vende produto de outra loja", async () => {
    const loja = await criarLoja("a");
    const outra = await criarLoja("b");
    const { variante } = await criarProduto(outra.id, "Relógio", 10000, 5);
    await expect(criarPedido(pedidoSite(loja.id, [{ varianteId: variante.id, quantidade: 1 }]))).rejects.toThrow(ErroNegocio);
  });
});

describe("ciclo do pedido", () => {
  it("pago lança a receita uma vez só e o status só anda para frente", async () => {
    const loja = await criarLoja();
    const { variante } = await criarProduto(loja.id, "Brinco", 5000, 5);
    const pedido = await criarPedido(pedidoSite(loja.id, [{ varianteId: variante.id, quantidade: 1 }]));
    await marcarComoPago(pedido.id);
    await marcarComoPago(pedido.id);
    expect(await db.select().from(lancamentos)).toHaveLength(1);
    await avancarStatus(pedido.id, "enviado", { codigoRastreio: "BR123" });
    await expect(avancarStatus(pedido.id, "separacao")).rejects.toThrow(ErroNegocio);
    const [p] = await db.select().from(pedidos).where(eq(pedidos.id, pedido.id));
    expect(p).toMatchObject({ status: "enviado", codigoRastreio: "BR123" });
  });

  it("cancelar devolve o estoque, o cupom e estorna a receita", async () => {
    const loja = await criarLoja();
    const { variante } = await criarProduto(loja.id, "Anel", 5000, 3);
    await db.insert(cupons).values({ lojaId: loja.id, codigo: "FIXO", tipo: "fixo", valor: 500 });
    const pedido = await criarPedido(pedidoSite(loja.id, [{ varianteId: variante.id, quantidade: 2 }], { cupomCodigo: "FIXO" }));
    await marcarComoPago(pedido.id);
    const cancelado = await cancelarPedido(pedido.id, "Cliente desistiu");
    expect(cancelado).toMatchObject({ status: "cancelado", statusPagamento: "estornado" });
    expect(await estoque(variante.id)).toBe(3);
    const [c] = await db.select().from(cupons);
    expect(c.usos).toBe(0);
    const [l] = await db.select().from(lancamentos);
    expect(l.status).toBe("cancelado");
    await expect(marcarComoPago(pedido.id)).rejects.toThrow(ErroNegocio);
  });

  it("pagamento do Mercado Pago depois do cancelamento fica registrado no histórico", async () => {
    const loja = await criarLoja();
    const { variante } = await criarProduto(loja.id, "Anel", 5000, 3);
    const pedido = await criarPedido(pedidoSite(loja.id, [{ varianteId: variante.id, quantidade: 1 }]));
    await cancelarPedido(pedido.id, "Teste");
    await marcarComoPago(pedido.id, { mpPagamentoId: "999" });
    const [p] = await db.select().from(pedidos).where(eq(pedidos.id, pedido.id));
    expect(p).toMatchObject({ status: "cancelado", statusPagamento: "aprovado", mpPagamentoId: "999" });
    const hist = await db.select().from(pedidoHistorico).where(eq(pedidoHistorico.pedidoId, pedido.id));
    expect(hist.at(-1)?.nota).toContain("depois do cancelamento");
  });

  it("cancela só os pedidos do site vencidos", async () => {
    const loja = await criarLoja();
    const { variante } = await criarProduto(loja.id, "Anel", 5000, 10);
    const velho = await criarPedido(pedidoSite(loja.id, [{ varianteId: variante.id, quantidade: 1 }]));
    const novo = await criarPedido(pedidoSite(loja.id, [{ varianteId: variante.id, quantidade: 1 }]));
    const pago = await criarPedido(pedidoSite(loja.id, [{ varianteId: variante.id, quantidade: 1 }]));
    await marcarComoPago(pago.id);
    const tresDiasAtras = new Date(Date.now() - 72 * 3_600_000);
    await db.update(pedidos).set({ criadoEm: tresDiasAtras }).where(eq(pedidos.id, velho.id));
    await db.update(pedidos).set({ criadoEm: tresDiasAtras }).where(eq(pedidos.id, pago.id));
    expect(await cancelarPedidosVencidos()).toBe(1);
    const status = Object.fromEntries((await db.select().from(pedidos)).map((p) => [p.id, p.status]));
    expect(status).toEqual({ [velho.id]: "cancelado", [novo.id]: "aguardando_pagamento", [pago.id]: "pago" });
    expect(await estoque(variante.id)).toBe(8);
  });
});

describe("estoque, compras e financeiro", () => {
  it("ajusta por entrada, saída e contagem", async () => {
    const loja = await criarLoja();
    const { variante } = await criarProduto(loja.id, "Colar", 5000, 4);
    expect(await ajustarEstoque({ lojaId: loja.id, varianteId: variante.id, modo: "entrada", quantidade: 6 })).toBe(10);
    expect(await ajustarEstoque({ lojaId: loja.id, varianteId: variante.id, modo: "saida", quantidade: 3 })).toBe(7);
    expect(await ajustarEstoque({ lojaId: loja.id, varianteId: variante.id, modo: "contagem", quantidade: 2 })).toBe(2);
    await expect(ajustarEstoque({ lojaId: loja.id, varianteId: variante.id, modo: "saida", quantidade: 5 })).rejects.toThrow(ErroNegocio);
    const movs = await db.select().from(movimentosEstoque);
    expect(movs.map((m) => [m.tipo, m.quantidade])).toEqual([["entrada", 6], ["saida", -3], ["ajuste", -5]]);
  });

  it("receber compra soma estoque, faz custo médio com frete rateado e lança a conta a pagar", async () => {
    const loja = await criarLoja();
    const a = await criarProduto(loja.id, "Brinco", 5000, 10, 1000);
    const b = await criarProduto(loja.id, "Colar", 9000, 0, 0);
    const compra = await criarCompra({
      lojaId: loja.id,
      fornecedorId: null,
      itens: [
        { varianteId: a.variante.id, quantidade: 10, custoUnitCentavos: 2000 },
        { varianteId: b.variante.id, quantidade: 5, custoUnitCentavos: 4000 },
      ],
      freteCentavos: 4000,
      vencimento: "2026-12-10",
    });
    expect(compra.totalCentavos).toBe(44000);
    await receberCompra(compra.id, loja.id);
    const [va] = await db.select().from(variantes).where(eq(variantes.id, a.variante.id));
    const [vb] = await db.select().from(variantes).where(eq(variantes.id, b.variante.id));
    // itens valem 200,00 cada, então o frete de 40,00 fica meio a meio: +2,00/un no brinco e +4,00/un no colar
    expect(va).toMatchObject({ estoque: 20, custoCentavos: 1600 }); // (10*10,00 + 10*22,00) / 20
    expect(vb).toMatchObject({ estoque: 5, custoCentavos: 4400 });
    const [conta] = await db.select().from(lancamentos);
    expect(conta).toMatchObject({ tipo: "despesa", status: "pendente", valorCentavos: 44000, vencimento: "2026-12-10" });
    await expect(receberCompra(compra.id, loja.id)).rejects.toThrow(ErroNegocio);
  });

  it("resume o mês", async () => {
    const loja = await criarLoja();
    const hoje = hojeSP();
    await criarLancamento({ lojaId: loja.id, tipo: "receita", categoria: "", descricao: "Venda feira", valorCentavos: 10000, vencimento: hoje, pago: true });
    await criarLancamento({ lojaId: loja.id, tipo: "despesa", categoria: "Aluguel", descricao: "Aluguel", valorCentavos: 3000, vencimento: hoje, pago: true });
    await criarLancamento({ lojaId: loja.id, tipo: "despesa", categoria: "Luz", descricao: "Luz", valorCentavos: 500, vencimento: hoje, pago: false });
    expect(await resumoDoMes(loja.id, hoje.slice(0, 7))).toEqual({ recebido: 10000, aReceber: 0, pago: 3000, aPagar: 500, saldo: 7000 });
  });
});
