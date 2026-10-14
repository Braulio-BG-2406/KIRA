import { randomBytes } from "node:crypto";
import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  clientes,
  cupons,
  lancamentos,
  lojas,
  movimentosEstoque,
  pedidoHistorico,
  pedidoItens,
  pedidos,
  produtos,
  variantes,
  type CanalVenda,
  type Entrega,
  type FormaPagamento,
  type Pedido,
  type StatusPedido,
} from "@/db/schema";
import { aplicarCupom } from "./cupom";
import { opcoesDeFrete } from "./frete";
import { hojeSP } from "./datas";
import { soDigitos } from "./texto";
import { ErroNegocio } from "./erros";
import { NOMES_STATUS } from "./rotulos";

export { ErroNegocio };

const ETAPAS: StatusPedido[] = ["aguardando_pagamento", "pago", "separacao", "enviado", "entregue"];

export type NovoPedido = {
  lojaId: number;
  cliente: { nome: string; email?: string | null; telefone?: string | null; documento?: string | null };
  /** preço só pode ser trocado em venda feita pelo painel */
  itens: { varianteId: number; quantidade: number; precoUnitCentavos?: number }[];
  entrega: Entrega;
  /** sem valor, o frete sai da configuração da loja */
  freteManualCentavos?: number;
  cupomCodigo?: string | null;
  descontoExtraCentavos?: number;
  formaPagamento: FormaPagamento;
  canal: CanalVenda;
  observacoes?: string | null;
  jaPago?: boolean;
};

function gerarCodigo(): string {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(10);
  return Array.from(bytes, (b) => letras[b % letras.length]).join("");
}

async function acharOuCriarCliente(tx: Tx, lojaId: number, c: NovoPedido["cliente"], entrega: Entrega) {
  const email = c.email?.trim().toLowerCase() || null;
  const telefone = soDigitos(c.telefone) || null;
  const documento = soDigitos(c.documento) || null;
  let existente = null;
  if (email) {
    [existente] = await tx.select().from(clientes).where(and(eq(clientes.lojaId, lojaId), eq(clientes.email, email))).limit(1);
  }
  if (!existente && telefone) {
    [existente] = await tx
      .select()
      .from(clientes)
      .where(and(eq(clientes.lojaId, lojaId), eq(clientes.telefone, telefone)))
      .limit(1);
  }
  const dados = {
    nome: c.nome.trim(),
    ...(email ? { email } : {}),
    ...(telefone ? { telefone } : {}),
    ...(documento ? { documento } : {}),
    ...(entrega.endereco ? { endereco: entrega.endereco } : {}),
  };
  if (existente) {
    await tx.update(clientes).set(dados).where(eq(clientes.id, existente.id));
    return existente.id;
  }
  const [novo] = await tx
    .insert(clientes)
    .values({ lojaId, ...dados })
    .returning({ id: clientes.id });
  return novo.id;
}

export async function criarPedido(p: NovoPedido): Promise<Pedido> {
  if (!p.cliente.nome?.trim()) throw new ErroNegocio("Informe o nome do cliente.");
  const quantidades = new Map<number, { quantidade: number; preco?: number }>();
  for (const i of p.itens) {
    if (!Number.isInteger(i.quantidade) || i.quantidade < 1 || i.quantidade > 999) {
      throw new ErroNegocio("Quantidade inválida.");
    }
    const atual = quantidades.get(i.varianteId);
    quantidades.set(i.varianteId, {
      quantidade: (atual?.quantidade ?? 0) + i.quantidade,
      preco: i.precoUnitCentavos ?? atual?.preco,
    });
  }
  if (quantidades.size === 0) throw new ErroNegocio("O carrinho está vazio.");

  return db.transaction(async (tx) => {
    const [loja] = await tx.select().from(lojas).where(eq(lojas.id, p.lojaId));
    if (!loja) throw new ErroNegocio("Loja não encontrada.");

    const linhas = await tx
      .select({ v: variantes, produtoNome: produtos.nome, produtoAtivo: produtos.ativo, lojaId: produtos.lojaId })
      .from(variantes)
      .innerJoin(produtos, eq(produtos.id, variantes.produtoId))
      .where(inArray(variantes.id, [...quantidades.keys()]))
      .orderBy(asc(variantes.id));

    const itens = [];
    let subtotal = 0;
    for (const [varianteId, { quantidade, preco }] of quantidades) {
      const l = linhas.find((x) => x.v.id === varianteId);
      if (!l || l.lojaId !== p.lojaId) throw new ErroNegocio("Um dos produtos do carrinho não existe mais.");
      if (!l.v.ativo || (p.canal === "site" && !l.produtoAtivo)) {
        throw new ErroNegocio(`${l.produtoNome} não está mais à venda.`);
      }
      // baixa atômica: só passa se ainda houver estoque
      const baixa = await tx
        .update(variantes)
        .set({ estoque: sql`${variantes.estoque} - ${quantidade}` })
        .where(and(eq(variantes.id, varianteId), gte(variantes.estoque, quantidade)))
        .returning({ id: variantes.id });
      if (baixa.length === 0) {
        const nome = l.v.nome === "Padrão" ? l.produtoNome : `${l.produtoNome} (${l.v.nome})`;
        throw new ErroNegocio(`Estoque insuficiente: ${nome} tem ${l.v.estoque} unidade(s).`);
      }
      const precoUnit = p.canal !== "site" && preco != null ? preco : l.v.precoCentavos;
      subtotal += precoUnit * quantidade;
      itens.push({
        varianteId,
        produtoNome: l.produtoNome,
        varianteNome: l.v.nome,
        sku: l.v.sku,
        quantidade,
        precoUnitCentavos: precoUnit,
        custoUnitCentavos: l.v.custoCentavos,
      });
    }

    let desconto = Math.max(0, p.descontoExtraCentavos ?? 0);
    let cupomCodigo: string | null = null;
    if (p.cupomCodigo?.trim()) {
      const codigo = p.cupomCodigo.trim().toUpperCase();
      const [cupom] = await tx
        .select()
        .from(cupons)
        .where(and(eq(cupons.lojaId, p.lojaId), eq(cupons.codigo, codigo)))
        .for("update");
      const r = aplicarCupom(cupom, subtotal);
      if (!r.ok) throw new ErroNegocio(r.erro);
      desconto += r.descontoCentavos;
      cupomCodigo = codigo;
      await tx.update(cupons).set({ usos: sql`${cupons.usos} + 1` }).where(eq(cupons.id, cupom.id));
    }
    desconto = Math.min(desconto, subtotal);
    // desconto do Pix vale só no site e sobre os produtos (sem o frete)
    const descontoPix =
      p.canal === "site" && p.formaPagamento === "pix" && loja.descontoPixPct > 0
        ? Math.round(((subtotal - desconto) * loja.descontoPixPct) / 100)
        : 0;

    let entrega = p.entrega;
    let frete: number;
    if (p.freteManualCentavos != null) {
      frete = Math.max(0, p.freteManualCentavos);
    } else {
      const opcao = opcoesDeFrete(loja.frete, entrega.endereco?.uf ?? null, subtotal).find((o) => o.metodo === entrega.metodo);
      if (!opcao) throw new ErroNegocio("Forma de entrega indisponível para este endereço.");
      if (opcao.metodo === "entrega" && !entrega.endereco) throw new ErroNegocio("Informe o endereço de entrega.");
      frete = opcao.valorCentavos;
      entrega = { ...entrega, descricao: opcao.descricao, prazo: opcao.prazo };
    }

    const clienteId = await acharOuCriarCliente(tx, p.lojaId, p.cliente, entrega);
    const [{ numero }] = await tx
      .update(lojas)
      .set({ seqPedido: sql`${lojas.seqPedido} + 1` })
      .where(eq(lojas.id, p.lojaId))
      .returning({ numero: lojas.seqPedido });

    const agora = new Date();
    const [pedido] = await tx
      .insert(pedidos)
      .values({
        lojaId: p.lojaId,
        numero,
        codigo: gerarCodigo(),
        clienteId,
        canal: p.canal,
        status: p.jaPago ? "pago" : "aguardando_pagamento",
        formaPagamento: p.formaPagamento,
        statusPagamento: p.jaPago ? "aprovado" : "pendente",
        subtotalCentavos: subtotal,
        freteCentavos: frete,
        descontoCentavos: desconto,
        descontoPixCentavos: descontoPix,
        totalCentavos: Math.max(0, subtotal - desconto - descontoPix + frete),
        cupomCodigo,
        entrega,
        observacoes: p.observacoes?.trim() || null,
        pagoEm: p.jaPago ? agora : null,
      })
      .returning();

    await tx.insert(pedidoItens).values(itens.map((i) => ({ ...i, pedidoId: pedido.id })));
    await tx.insert(movimentosEstoque).values(
      itens.map((i) => ({
        lojaId: p.lojaId,
        varianteId: i.varianteId,
        quantidade: -i.quantidade,
        tipo: "venda" as const,
        pedidoId: pedido.id,
        nota: `Pedido #${numero}`,
      })),
    );
    await tx.insert(pedidoHistorico).values({
      pedidoId: pedido.id,
      status: pedido.status,
      nota: p.canal === "site" ? "Pedido feito no site" : "Venda registrada no painel",
    });
    if (p.jaPago) await lancarReceita(tx, pedido);
    return pedido;
  });
}

async function lancarReceita(tx: Tx, pedido: Pedido) {
  await tx
    .insert(lancamentos)
    .values({
      lojaId: pedido.lojaId,
      tipo: "receita",
      categoria: "Vendas",
      descricao: `Pedido #${pedido.numero}`,
      valorCentavos: pedido.totalCentavos,
      vencimento: hojeSP(),
      pagoEm: new Date(),
      status: "pago",
      pedidoId: pedido.id,
    })
    .onConflictDoNothing({ target: lancamentos.pedidoId });
}

async function travarPedido(tx: Tx, pedidoId: number) {
  const [pedido] = await tx.select().from(pedidos).where(eq(pedidos.id, pedidoId)).for("update");
  if (!pedido) throw new ErroNegocio("Pedido não encontrado.");
  return pedido;
}

export async function marcarComoPago(pedidoId: number, opcoes: { mpPagamentoId?: string; nota?: string } = {}) {
  return db.transaction(async (tx) => {
    const pedido = await travarPedido(tx, pedidoId);
    if (pedido.statusPagamento === "aprovado") return pedido;
    if (pedido.status === "cancelado") {
      if (opcoes.mpPagamentoId) {
        // o cliente pagou depois do prazo: avisa no histórico em vez de reativar sozinho
        await tx
          .update(pedidos)
          .set({ statusPagamento: "aprovado", mpPagamentoId: opcoes.mpPagamentoId, pagoEm: new Date(), atualizadoEm: new Date() })
          .where(eq(pedidos.id, pedidoId));
        await tx.insert(pedidoHistorico).values({
          pedidoId,
          status: "cancelado",
          nota: "Pagamento aprovado depois do cancelamento. Devolva o valor ou faça uma venda nova.",
        });
        return pedido;
      }
      throw new ErroNegocio("Este pedido está cancelado.");
    }
    const [atualizado] = await tx
      .update(pedidos)
      .set({
        statusPagamento: "aprovado",
        status: pedido.status === "aguardando_pagamento" ? "pago" : pedido.status,
        pagoEm: new Date(),
        mpPagamentoId: opcoes.mpPagamentoId ?? pedido.mpPagamentoId,
        atualizadoEm: new Date(),
      })
      .where(eq(pedidos.id, pedidoId))
      .returning();
    await tx.insert(pedidoHistorico).values({ pedidoId, status: "pago", nota: opcoes.nota ?? "Pagamento confirmado" });
    await lancarReceita(tx, atualizado);
    return atualizado;
  });
}

export async function avancarStatus(
  pedidoId: number,
  novo: "separacao" | "enviado" | "entregue",
  opcoes: { codigoRastreio?: string | null; nota?: string | null } = {},
) {
  return db.transaction(async (tx) => {
    const pedido = await travarPedido(tx, pedidoId);
    if (pedido.status === "cancelado") throw new ErroNegocio("Este pedido está cancelado.");
    if (ETAPAS.indexOf(novo) <= ETAPAS.indexOf(pedido.status)) {
      throw new ErroNegocio(`O pedido já está em "${NOMES_STATUS[pedido.status]}".`);
    }
    const rastreio = opcoes.codigoRastreio?.trim() || pedido.codigoRastreio;
    const [atualizado] = await tx
      .update(pedidos)
      .set({ status: novo, codigoRastreio: rastreio, atualizadoEm: new Date() })
      .where(eq(pedidos.id, pedidoId))
      .returning();
    const nota = opcoes.nota?.trim() || (novo === "enviado" && rastreio ? `Código de rastreio: ${rastreio}` : null);
    await tx.insert(pedidoHistorico).values({ pedidoId, status: novo, nota });
    return atualizado;
  });
}

export async function cancelarPedido(pedidoId: number, motivo: string, opcoes: { somenteSeAguardando?: boolean } = {}) {
  return db.transaction(async (tx) => {
    const pedido = await travarPedido(tx, pedidoId);
    if (pedido.status === "cancelado") return pedido;
    // o pagamento pode ter chegado entre a busca e a trava
    if (opcoes.somenteSeAguardando && pedido.status !== "aguardando_pagamento") return pedido;
    if (pedido.status === "entregue") throw new ErroNegocio("Pedido entregue não pode ser cancelado.");

    const itens = await tx.select().from(pedidoItens).where(eq(pedidoItens.pedidoId, pedidoId));
    for (const i of itens) {
      if (i.varianteId == null) continue;
      await tx
        .update(variantes)
        .set({ estoque: sql`${variantes.estoque} + ${i.quantidade}` })
        .where(eq(variantes.id, i.varianteId));
      await tx.insert(movimentosEstoque).values({
        lojaId: pedido.lojaId,
        varianteId: i.varianteId,
        quantidade: i.quantidade,
        tipo: "cancelamento",
        pedidoId,
        nota: `Pedido #${pedido.numero} cancelado`,
      });
    }
    if (pedido.cupomCodigo) {
      await tx
        .update(cupons)
        .set({ usos: sql`greatest(${cupons.usos} - 1, 0)` })
        .where(and(eq(cupons.lojaId, pedido.lojaId), eq(cupons.codigo, pedido.cupomCodigo)));
    }
    const estavaPago = pedido.statusPagamento === "aprovado";
    await tx.update(lancamentos).set({ status: "cancelado" }).where(eq(lancamentos.pedidoId, pedidoId));
    const [atualizado] = await tx
      .update(pedidos)
      .set({ status: "cancelado", statusPagamento: estavaPago ? "estornado" : pedido.statusPagamento, atualizadoEm: new Date() })
      .where(eq(pedidos.id, pedidoId))
      .returning();
    await tx.insert(pedidoHistorico).values({
      pedidoId,
      status: "cancelado",
      nota: estavaPago ? `${motivo}. O valor pago precisa ser devolvido ao cliente.` : motivo,
    });
    return atualizado;
  });
}

/** cancela os pedidos do site que passaram do prazo de pagamento e devolve o estoque */
export async function cancelarPedidosVencidos(agora = new Date()): Promise<number> {
  const todas = await db.select({ id: lojas.id, horas: lojas.horasReserva }).from(lojas);
  let total = 0;
  for (const loja of todas) {
    const limite = new Date(agora.getTime() - loja.horas * 3_600_000);
    const vencidos = await db
      .select({ id: pedidos.id })
      .from(pedidos)
      .where(
        and(
          eq(pedidos.lojaId, loja.id),
          eq(pedidos.status, "aguardando_pagamento"),
          eq(pedidos.canal, "site"),
          lt(pedidos.criadoEm, limite),
        ),
      );
    for (const p of vencidos) {
      const r = await cancelarPedido(p.id, "Prazo de pagamento expirou", { somenteSeAguardando: true });
      if (r.status === "cancelado") total++;
    }
  }
  return total;
}
