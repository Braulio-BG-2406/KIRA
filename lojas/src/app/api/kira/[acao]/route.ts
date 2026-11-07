import { and, desc, eq, ilike, inArray } from "drizzle-orm";
import { db } from "@/db";
import { clientes, pedidos, type StatusPedido } from "@/db/schema";
import { kiraAutorizada } from "@/lib/kira";
import { todasAsLojas } from "@/lib/lojas";
import { estoqueBaixo, resumoDaLoja } from "@/lib/consultas";
import { categoriasDaLoja, listarVitrine } from "@/lib/catalogo";
import { legendaInstagram } from "@/lib/divulgacao";
import { absoluta, urlDaLoja } from "@/lib/dominios";
import { cancelarPedidosVencidos } from "@/lib/pedidos";
import { manutencaoDosCanais } from "@/lib/canais/sincronizar";
import { resumoDoMes } from "@/lib/financeiro";
import { hojeSP } from "@/lib/datas";
import { NOMES_STATUS } from "@/lib/rotulos";
import { urlPublica } from "@/lib/mercadopago";

// API só de leitura para a Kira (n8n). Valores em centavos.
type Ctx = { params: Promise<{ acao: string }> };

async function lojasPedidas(req: Request) {
  const slug = new URL(req.url).searchParams.get("loja");
  const todas = await todasAsLojas();
  return slug ? todas.filter((l) => l.slug === slug) : todas;
}

export async function GET(req: Request, { params }: Ctx) {
  if (!kiraAutorizada(req)) return Response.json({ erro: "não autorizado" }, { status: 401 });
  const { acao } = await params;
  const url = new URL(req.url);
  const lojas = await lojasPedidas(req);

  if (acao === "resumo") {
    const mes = hojeSP().slice(0, 7);
    return Response.json({
      lojas: await Promise.all(lojas.map(async (l) => ({ ...(await resumoDaLoja(l)), financeiroDoMes: await resumoDoMes(l.id, mes) }))),
    });
  }

  if (acao === "pedidos") {
    const status = (url.searchParams.get("status") ?? "aguardando_pagamento,pago,separacao").split(",").filter((s) => s in NOMES_STATUS) as StatusPedido[];
    const limite = Math.min(100, parseInt(url.searchParams.get("limite") ?? "30", 10) || 30);
    const resultado = [];
    for (const l of lojas) {
      const lista = await db
        .select({ p: pedidos, cliente: clientes.nome, telefone: clientes.telefone })
        .from(pedidos)
        .leftJoin(clientes, eq(clientes.id, pedidos.clienteId))
        .where(and(eq(pedidos.lojaId, l.id), inArray(pedidos.status, status)))
        .orderBy(desc(pedidos.criadoEm))
        .limit(limite);
      resultado.push(
        ...lista.map(({ p, cliente, telefone }) => ({
          loja: l.slug,
          numero: p.numero,
          status: p.status,
          statusTexto: NOMES_STATUS[p.status],
          pago: p.statusPagamento === "aprovado",
          totalCentavos: p.totalCentavos,
          cliente,
          telefone,
          canal: p.canal,
          criadoEm: p.criadoEm,
          linkPainel: `${urlPublica()}/admin/pedidos/${p.id}`,
        })),
      );
    }
    return Response.json({ pedidos: resultado });
  }

  if (acao === "estoque-baixo") {
    return Response.json({ lojas: await Promise.all(lojas.map(async (l) => ({ loja: l.slug, minimo: l.estoqueMinimo, itens: await estoqueBaixo(l) }))) });
  }

  if (acao === "produtos") {
    const q = url.searchParams.get("q") ?? "";
    return Response.json({
      lojas: await Promise.all(
        lojas.map(async (l) => ({
          loja: l.slug,
          produtos: (await listarVitrine({ lojaId: l.id, busca: q, limite: 30 })).map((p) => ({
            nome: p.nome,
            precoMinCentavos: p.precoMin,
            estoque: p.estoqueTotal,
            variacoes: p.variantes.map((v) => ({ nome: v.nome, sku: v.sku, precoCentavos: v.precoCentavos, estoque: v.estoque })),
          })),
        })),
      ),
    });
  }

  if (acao === "divulgar") {
    // a Kira usa para montar o post do Instagram: foto pública, link e legenda
    const q = url.searchParams.get("q") ?? "";
    const resultado = [];
    for (const l of lojas) {
      const cats = await categoriasDaLoja(l.id);
      const lista = await listarVitrine({ lojaId: l.id, busca: q, destaque: !q, limite: 5 });
      for (const p of lista.filter((x) => x.estoqueTotal > 0)) {
        const link = `${urlDaLoja(l.slug)}/produto/${p.slug}`;
        resultado.push({
          loja: l.slug,
          produto: p.nome,
          precoCentavos: p.precoMin,
          estoque: p.estoqueTotal,
          link,
          imagens: p.imagens.map((i) => absoluta(i)),
          legenda: legendaInstagram(l, p, link, cats.find((c) => c.id === p.categoriaId)?.nome),
        });
      }
    }
    return Response.json({ produtos: resultado, dica: q ? undefined : "sem ?q= vêm os destaques com estoque" });
  }

  if (acao === "clientes") {
    const q = (url.searchParams.get("q") ?? "").trim();
    if (!q) return Response.json({ erro: "informe ?q=" }, { status: 400 });
    const termo = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    const lista = await db
      .select({ nome: clientes.nome, telefone: clientes.telefone, email: clientes.email, lojaId: clientes.lojaId })
      .from(clientes)
      .where(and(inArray(clientes.lojaId, lojas.map((l) => l.id)), ilike(clientes.nome, termo)))
      .limit(20);
    return Response.json({ clientes: lista.map((c) => ({ ...c, loja: lojas.find((l) => l.id === c.lojaId)?.slug })) });
  }

  return Response.json({ erro: "ação desconhecida", acoes: ["resumo", "pedidos", "estoque-baixo", "produtos", "divulgar", "clientes", "POST manutencao"] }, { status: 404 });
}

export async function POST(req: Request, { params }: Ctx) {
  if (!kiraAutorizada(req)) return Response.json({ erro: "não autorizado" }, { status: 401 });
  if ((await params).acao !== "manutencao") return Response.json({ erro: "ação desconhecida" }, { status: 404 });
  const pedidosCancelados = await cancelarPedidosVencidos();
  // pedidos novos de Mercado Livre e Shopee que algum aviso não trouxe + estoque em dia
  const marketplaces = await manutencaoDosCanais();
  return Response.json({ pedidosCancelados, marketplaces });
}
