"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pedidos, type CanalVenda, type FormaPagamento } from "@/db/schema";
import { contexto, executar, texto } from "@/lib/painel";
import { avancarStatus, cancelarPedido, criarPedido, marcarComoPago } from "@/lib/pedidos";
import { ErroNegocio } from "@/lib/erros";
import { NOMES_CANAL, NOMES_PAGAMENTO } from "@/lib/rotulos";

async function pedidoDaLoja(id: number, lojaId: number) {
  const [p] = await db.select({ id: pedidos.id }).from(pedidos).where(and(eq(pedidos.id, id), eq(pedidos.lojaId, lojaId)));
  if (!p) throw new ErroNegocio("Pedido não encontrado.");
  return p.id;
}

export async function acaoMarcarPago(fd: FormData) {
  const { loja } = await contexto();
  const id = Number(fd.get("id"));
  await executar(`/admin/pedidos/${id}`, async () => {
    await marcarComoPago(await pedidoDaLoja(id, loja.id), { nota: "Pagamento confirmado no painel" });
  }, "Pagamento registrado.");
}

export async function acaoAvancar(fd: FormData) {
  const { loja } = await contexto();
  const id = Number(fd.get("id"));
  const novo = texto(fd, "status") as "separacao" | "enviado" | "entregue";
  await executar(`/admin/pedidos/${id}`, async () => {
    if (!["separacao", "enviado", "entregue"].includes(novo)) throw new ErroNegocio("Status inválido.");
    await avancarStatus(await pedidoDaLoja(id, loja.id), novo, { codigoRastreio: texto(fd, "rastreio"), nota: texto(fd, "nota") });
  }, "Status atualizado.");
}

export async function acaoCancelar(fd: FormData) {
  const { loja } = await contexto();
  const id = Number(fd.get("id"));
  await executar(`/admin/pedidos/${id}`, async () => {
    await cancelarPedido(await pedidoDaLoja(id, loja.id), texto(fd, "motivo") || "Cancelado no painel");
  }, "Pedido cancelado e estoque devolvido.");
}

export async function acaoObservacao(fd: FormData) {
  const { loja } = await contexto();
  const id = Number(fd.get("id"));
  await executar(`/admin/pedidos/${id}`, async () => {
    await db.update(pedidos).set({ observacoes: texto(fd, "observacoes") || null }).where(eq(pedidos.id, await pedidoDaLoja(id, loja.id)));
  });
}

type Venda = {
  cliente: { nome: string; telefone: string; email: string; documento: string };
  itens: { varianteId: number; quantidade: number; precoCentavos: number }[];
  canal: CanalVenda;
  formaPagamento: FormaPagamento;
  jaPago: boolean;
  descontoCentavos: number;
  freteCentavos: number;
  entrega: "retirada" | "entrega";
  endereco: string;
  observacoes: string;
};

export async function acaoNovaVenda(fd: FormData) {
  const { loja } = await contexto();
  await executar("/admin/pedidos/novo", async () => {
    let v: Venda;
    try {
      v = JSON.parse(String(fd.get("venda")));
    } catch {
      throw new ErroNegocio("Dados da venda inválidos.");
    }
    if (!(v.canal in NOMES_CANAL) || !(v.formaPagamento in NOMES_PAGAMENTO)) throw new ErroNegocio("Escolha o canal e a forma de pagamento.");
    const pedido = await criarPedido({
      lojaId: loja.id,
      canal: v.canal,
      formaPagamento: v.formaPagamento,
      jaPago: !!v.jaPago,
      cliente: { nome: v.cliente.nome || "Cliente balcão", telefone: v.cliente.telefone, email: v.cliente.email, documento: v.cliente.documento },
      itens: v.itens.map((i) => ({ varianteId: Number(i.varianteId), quantidade: Number(i.quantidade), precoUnitCentavos: Math.max(0, Number(i.precoCentavos)) })),
      descontoExtraCentavos: Math.max(0, Number(v.descontoCentavos) || 0),
      freteManualCentavos: Math.max(0, Number(v.freteCentavos) || 0),
      entrega:
        v.entrega === "entrega"
          ? { metodo: "entrega", descricao: "Entrega", enderecoTexto: String(v.endereco ?? "").slice(0, 300) }
          : { metodo: "retirada", descricao: "Retirada / entrega em mãos" },
      observacoes: v.observacoes,
    });
    return `/admin/pedidos/${pedido.id}`;
  }, "Venda registrada.");
}
