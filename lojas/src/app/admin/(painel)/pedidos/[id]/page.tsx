import { notFound } from "next/navigation";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clientes, pedidoHistorico, pedidoItens, pedidos } from "@/db/schema";
import { contexto } from "@/lib/painel";
import { formatarReais } from "@/lib/dinheiro";
import { formatarDataHora } from "@/lib/datas";
import { linkWhatsapp } from "@/lib/texto";
import { urlDaLoja } from "@/lib/dominios";
import { NOMES_CANAL, NOMES_PAGAMENTO, NOMES_STATUS } from "@/lib/rotulos";
import { Aviso, Cabecalho, Cartao, Etiqueta } from "@/components/admin/ui";
import { Confirmar, Enviar, Imprimir } from "@/components/admin/Botoes";
import { acaoAvancar, acaoCancelar, acaoMarcarPago, acaoObservacao } from "../acoes";

export default async function Pedido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { loja } = await contexto();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [pedido] = await db.select().from(pedidos).where(and(eq(pedidos.id, id), eq(pedidos.lojaId, loja.id)));
  if (!pedido) notFound();
  const [itens, historico, [cliente]] = await Promise.all([
    db.select().from(pedidoItens).where(eq(pedidoItens.pedidoId, id)).orderBy(asc(pedidoItens.id)),
    db.select().from(pedidoHistorico).where(eq(pedidoHistorico.pedidoId, id)).orderBy(asc(pedidoHistorico.id)),
    pedido.clienteId ? db.select().from(clientes).where(eq(clientes.id, pedido.clienteId)) : Promise.resolve([]),
  ]);
  const sp = await searchParams;
  const aberto = !["cancelado", "entregue"].includes(pedido.status);
  const pago = pedido.statusPagamento === "aprovado";
  const custo = itens.reduce((s, i) => s + i.custoUnitCentavos * i.quantidade, 0);
  const end = pedido.entrega.endereco;
  const linkCliente = `${urlDaLoja(loja.slug)}/pedido/${pedido.codigo}`;

  return (
    <>
      <Cabecalho titulo={`Pedido #${pedido.numero}`} voltar="/admin/pedidos">
        <Etiqueta valor={pedido.status} texto={NOMES_STATUS[pedido.status]} />
        <Imprimir />
      </Cabecalho>
      <Aviso ok={sp.ok} erro={sp.erro} />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Cartao titulo="Itens">
            <ul className="divide-y divide-stone-100 text-sm">
              {itens.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 py-2">
                  <span>
                    {i.quantidade}× {i.produtoNome}
                    {i.varianteNome !== "Padrão" && <span className="text-stone-500"> · {i.varianteNome}</span>}
                    {i.sku && <span className="ml-2 text-xs text-stone-400">{i.sku}</span>}
                  </span>
                  <span className="tabular-nums">{formatarReais(i.precoUnitCentavos * i.quantidade)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-stone-200 pt-3 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{formatarReais(pedido.subtotalCentavos)}</dd></div>
              {pedido.descontoCentavos > 0 && (
                <div className="flex justify-between text-green-700"><dt>Desconto {pedido.cupomCodigo && `(${pedido.cupomCodigo})`}</dt><dd className="tabular-nums">− {formatarReais(pedido.descontoCentavos)}</dd></div>
              )}
              <div className="flex justify-between"><dt>Frete</dt><dd className="tabular-nums">{formatarReais(pedido.freteCentavos)}</dd></div>
              <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatarReais(pedido.totalCentavos)}</dd></div>
              <div className="flex justify-between text-xs text-stone-500 print:hidden">
                <dt>Lucro bruto (sem frete)</dt>
                <dd className="tabular-nums">{formatarReais(pedido.subtotalCentavos - pedido.descontoCentavos - custo)}</dd>
              </div>
            </dl>
          </Cartao>

          <Cartao titulo="Entrega">
            <p className="text-sm font-medium">{pedido.entrega.descricao}</p>
            {end && (
              <p className="mt-1 text-sm text-stone-600">
                {end.logradouro}, {end.numero}
                {end.complemento && ` - ${end.complemento}`}
                <br />
                {end.bairro} · {end.cidade}/{end.uf} · CEP {end.cep}
              </p>
            )}
            {pedido.entrega.enderecoTexto && <p className="mt-1 whitespace-pre-line text-sm text-stone-600">{pedido.entrega.enderecoTexto}</p>}
            {pedido.entrega.prazo && <p className="mt-1 text-xs text-stone-500">{pedido.entrega.prazo}</p>}
            {pedido.codigoRastreio && <p className="mt-2 text-sm">Rastreio: <span className="font-mono">{pedido.codigoRastreio}</span></p>}
          </Cartao>

          <Cartao titulo="Histórico" className="print:hidden">
            <ul className="space-y-2 text-sm">
              {historico.map((h) => (
                <li key={h.id} className="flex gap-3">
                  <span className="w-28 shrink-0 text-stone-500">{formatarDataHora(h.criadoEm)}</span>
                  <span>
                    {NOMES_STATUS[h.status]}
                    {h.nota && <span className="block text-stone-500">{h.nota}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Cartao>
        </div>

        <div className="space-y-6">
          <Cartao titulo="Cliente">
            {cliente ? (
              <div className="space-y-1 text-sm">
                <Link href={`/admin/clientes/${cliente.id}`} className="font-medium hover:underline">{cliente.nome}</Link>
                {cliente.telefone && <p>{cliente.telefone}</p>}
                {cliente.email && <p className="break-all text-stone-600">{cliente.email}</p>}
                {cliente.documento && <p className="text-stone-600">CPF/CNPJ {cliente.documento}</p>}
                {cliente.telefone && (
                  <a
                    href={linkWhatsapp(cliente.telefone, `Olá, ${cliente.nome.split(" ")[0]}! Aqui é da ${loja.nome}, sobre o seu pedido #${pedido.numero}: ${linkCliente}`)}
                    target="_blank"
                    rel="noopener"
                    className="botao-secundario mt-2 w-full print:hidden"
                  >
                    Falar no WhatsApp
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-stone-500">Sem cliente.</p>
            )}
          </Cartao>

          <Cartao titulo="Pagamento">
            <p className="text-sm">{NOMES_PAGAMENTO[pedido.formaPagamento]} · {NOMES_CANAL[pedido.canal]}</p>
            <p className="mt-1 text-sm">
              {pago ? `Pago em ${formatarDataHora(pedido.pagoEm)}` : pedido.statusPagamento === "estornado" ? "Pago e cancelado: devolver ao cliente" : "Ainda não pago"}
            </p>
            {aberto && !pago && (
              <form action={acaoMarcarPago} className="mt-3 print:hidden">
                <input type="hidden" name="id" value={pedido.id} />
                <Enviar className="botao-primario w-full">Confirmar pagamento</Enviar>
              </form>
            )}
          </Cartao>

          {aberto && (
            <Cartao titulo="Andamento" className="print:hidden">
              <form action={acaoAvancar} className="space-y-3">
                <input type="hidden" name="id" value={pedido.id} />
                <select name="status" className="campo" defaultValue={pedido.status === "enviado" ? "entregue" : pedido.status === "separacao" ? "enviado" : "separacao"}>
                  <option value="separacao">Em separação</option>
                  <option value="enviado">Enviado</option>
                  <option value="entregue">Entregue</option>
                </select>
                <input name="rastreio" placeholder="Código de rastreio (opcional)" defaultValue={pedido.codigoRastreio ?? ""} className="campo" />
                <Enviar className="botao-secundario w-full">Atualizar status</Enviar>
              </form>
              <form action={acaoCancelar} className="mt-5 space-y-2 border-t border-stone-100 pt-4">
                <input type="hidden" name="id" value={pedido.id} />
                <input name="motivo" placeholder="Motivo do cancelamento" className="campo" />
                <Confirmar pergunta="Cancelar este pedido? O estoque volta para a loja." className="botao-perigo w-full">
                  Cancelar pedido
                </Confirmar>
              </form>
            </Cartao>
          )}

          <Cartao titulo="Observações" className="print:hidden">
            <form action={acaoObservacao} className="space-y-2">
              <input type="hidden" name="id" value={pedido.id} />
              <textarea name="observacoes" rows={3} defaultValue={pedido.observacoes ?? ""} className="campo" />
              <Enviar className="botao-secundario w-full">Salvar</Enviar>
            </form>
            <p className="mt-3 break-all text-xs text-stone-500">
              Link do cliente: <a href={linkCliente} target="_blank" rel="noopener" className="underline">{linkCliente}</a>
            </p>
          </Cartao>
        </div>
      </div>
    </>
  );
}
