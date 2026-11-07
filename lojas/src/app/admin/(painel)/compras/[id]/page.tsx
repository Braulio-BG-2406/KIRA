import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { compraItens, compras, fornecedores, produtos, variantes } from "@/db/schema";
import { contexto } from "@/lib/painel";
import { formatarReais } from "@/lib/dinheiro";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { Aviso, Cabecalho, Cartao, Etiqueta } from "@/components/admin/ui";
import { Confirmar, Enviar } from "@/components/admin/Botoes";
import { acaoCancelarCompra, acaoReceberCompra } from "../acoes";

const NOMES = { rascunho: "Aguardando chegada", recebida: "Recebida", cancelada: "Cancelada" };

export default async function Compra({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { loja } = await contexto();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [c] = await db.select().from(compras).where(and(eq(compras.id, id), eq(compras.lojaId, loja.id)));
  if (!c) notFound();
  const [itens, [forn], sp] = await Promise.all([
    db
      .select({ i: compraItens, produto: produtos.nome, variante: variantes.nome })
      .from(compraItens)
      .innerJoin(variantes, eq(variantes.id, compraItens.varianteId))
      .innerJoin(produtos, eq(produtos.id, variantes.produtoId))
      .where(eq(compraItens.compraId, id)),
    c.fornecedorId ? db.select().from(fornecedores).where(eq(fornecedores.id, c.fornecedorId)) : Promise.resolve([]),
    searchParams,
  ]);
  return (
    <>
      <Cabecalho titulo={`Compra #${c.id}`} voltar="/admin/compras">
        <Etiqueta valor={c.status} texto={NOMES[c.status]} />
      </Cabecalho>
      <Aviso ok={sp.ok} erro={sp.erro} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Cartao titulo="Itens">
          <ul className="divide-y divide-stone-100 text-sm">
            {itens.map(({ i, produto, variante }) => (
              <li key={i.id} className="flex justify-between gap-3 py-2">
                <span>{i.quantidade}× {produto}{variante !== "Padrão" && <span className="text-stone-500"> · {variante}</span>}</span>
                <span className="tabular-nums">{formatarReais(i.custoUnitCentavos)} un. · {formatarReais(i.custoUnitCentavos * i.quantidade)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1 border-t border-stone-200 pt-3 text-sm">
            <div className="flex justify-between"><dt>Frete / taxas</dt><dd className="tabular-nums">{formatarReais(c.freteCentavos)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatarReais(c.totalCentavos)}</dd></div>
          </dl>
        </Cartao>
        <div className="space-y-6">
          <Cartao titulo="Dados">
            <dl className="space-y-1 text-sm">
              <div><dt className="inline text-stone-500">Fornecedor: </dt><dd className="inline">{forn?.nome ?? "—"}</dd></div>
              <div><dt className="inline text-stone-500">Criada em: </dt><dd className="inline">{formatarDataHora(c.criadoEm)}</dd></div>
              <div><dt className="inline text-stone-500">Vencimento: </dt><dd className="inline">{formatarData(c.vencimento)}</dd></div>
              {c.recebidaEm && <div><dt className="inline text-stone-500">Recebida em: </dt><dd className="inline">{formatarDataHora(c.recebidaEm)}</dd></div>}
              {c.observacoes && <p className="pt-2 text-stone-600">{c.observacoes}</p>}
            </dl>
          </Cartao>
          {c.status === "rascunho" && (
            <Cartao titulo="Chegou a mercadoria?">
              <form action={acaoReceberCompra}>
                <input type="hidden" name="id" value={c.id} />
                <Enviar className="botao-primario w-full">Dar entrada no estoque</Enviar>
              </form>
              <form action={acaoCancelarCompra} className="mt-3">
                <input type="hidden" name="id" value={c.id} />
                <Confirmar pergunta="Cancelar esta compra?" className="botao-perigo w-full">Cancelar compra</Confirmar>
              </form>
            </Cartao>
          )}
        </div>
      </div>
    </>
  );
}
