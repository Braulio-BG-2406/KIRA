/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import QRCode from "qrcode";
import { db } from "@/db";
import { pedidoHistorico, pedidoItens, pedidos } from "@/db/schema";
import { buscarLoja } from "@/lib/lojas";
import { formatarReais } from "@/lib/dinheiro";
import { formatarDataHora } from "@/lib/datas";
import { gerarPixCopiaECola } from "@/lib/pix";
import { linkWhatsapp } from "@/lib/texto";
import { NOMES_PAGAMENTO, NOMES_STATUS } from "@/lib/rotulos";
import { Copiar } from "@/components/loja/Copiar";

export const metadata = { title: "Seu pedido", robots: { index: false } };

const ETAPAS = ["aguardando_pagamento", "pago", "separacao", "enviado", "entregue"] as const;

export default async function PaginaPedido({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; codigo: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { slug, codigo } = await params;
  const loja = await buscarLoja(slug);
  if (!loja) notFound();
  const [pedido] = await db.select().from(pedidos).where(and(eq(pedidos.lojaId, loja.id), eq(pedidos.codigo, codigo.toUpperCase())));
  if (!pedido) notFound();
  const [itens, historico] = await Promise.all([
    db.select().from(pedidoItens).where(eq(pedidoItens.pedidoId, pedido.id)).orderBy(asc(pedidoItens.id)),
    db.select().from(pedidoHistorico).where(eq(pedidoHistorico.pedidoId, pedido.id)).orderBy(asc(pedidoHistorico.id)),
  ]);
  const aguardando = pedido.status === "aguardando_pagamento";
  const pix =
    aguardando && pedido.formaPagamento === "pix" && loja.pixChave
      ? gerarPixCopiaECola({
          chave: loja.pixChave,
          nome: loja.pixNome || loja.nome,
          cidade: loja.pixCidade || "BRASIL",
          valorCentavos: pedido.totalCentavos,
          txid: `PED${pedido.numero}`,
        })
      : null;
  const qr = pix ? await QRCode.toDataURL(pix, { margin: 1, width: 260 }) : null;
  const etapaAtual = ETAPAS.indexOf(pedido.status as (typeof ETAPAS)[number]);
  const resumo = `Olá! Fiz o pedido #${pedido.numero} (código ${pedido.codigo}) no site, total ${formatarReais(pedido.totalCentavos)}.`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm text-stone-500">Pedido #{pedido.numero} · código {pedido.codigo}</p>
      <h1 className="mt-1 font-titulo text-4xl text-marca">
        {pedido.status === "cancelado" ? "Pedido cancelado" : aguardando ? "Pedido recebido!" : NOMES_STATUS[pedido.status]}
      </h1>
      <p className="mt-2 text-sm text-stone-600">Guarde este link para acompanhar o pedido.</p>

      {(await searchParams).erro === "pagamento" && (
        <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">Não conseguimos abrir o pagamento agora. Tente de novo em instantes.</p>
      )}

      {pedido.status !== "cancelado" && (
        <ol className="mt-8 grid grid-cols-5 gap-1 text-center text-[11px] text-stone-500">
          {ETAPAS.map((e, i) => (
            <li key={e}>
              <div className={`mb-2 h-1.5 rounded-full ${i <= etapaAtual ? "bg-marca" : "bg-stone-200"}`} />
              <span className={i === etapaAtual ? "font-medium text-marca" : ""}>{NOMES_STATUS[e]}</span>
            </li>
          ))}
        </ol>
      )}

      {pix && qr && (
        <section className="mt-8 rounded-xl border border-stone-200 p-6 text-center">
          <h2 className="font-medium">Pague com Pix</h2>
          <p className="mt-1 text-sm text-stone-600">Total: {formatarReais(pedido.totalCentavos)}</p>
          <img src={qr} alt="QR Code do Pix" className="mx-auto mt-4 h-56 w-56" />
          <p className="mt-4 break-all rounded-md bg-stone-50 p-3 text-left font-mono text-xs text-stone-600">{pix}</p>
          <div className="mx-auto mt-3 max-w-xs">
            <Copiar texto={pix} rotulo="Copiar código Pix" />
          </div>
          <p className="mt-4 text-xs text-stone-500">Assim que confirmarmos o pagamento, o status muda aqui.</p>
          {loja.whatsapp && (
            <a className="mt-2 inline-block text-sm underline" href={linkWhatsapp(loja.whatsapp, `${resumo} Segue o comprovante do Pix.`)} target="_blank" rel="noopener">
              Enviar comprovante pelo WhatsApp
            </a>
          )}
        </section>
      )}

      {aguardando && pedido.formaPagamento === "mercadopago" && (
        <form action={`/api/loja/${slug}/pedidos/${pedido.codigo}/pagar`} method="post" className="mt-8 rounded-xl border border-stone-200 p-6 text-center">
          <p className="text-sm text-stone-600">Se você ainda não concluiu o pagamento:</p>
          <button className="mt-3 rounded-md bg-[#009ee3] px-6 py-3 font-medium text-white hover:brightness-95">Pagar com Mercado Pago</button>
        </form>
      )}

      {aguardando && pedido.formaPagamento === "whatsapp" && loja.whatsapp && (
        <section className="mt-8 rounded-xl border border-stone-200 p-6 text-center">
          <p className="text-sm text-stone-600">Vamos combinar o pagamento pelo WhatsApp.</p>
          <a href={linkWhatsapp(loja.whatsapp, resumo)} target="_blank" rel="noopener" className="mt-3 inline-block rounded-md bg-[#25d366] px-6 py-3 font-medium text-white">
            Chamar no WhatsApp
          </a>
        </section>
      )}

      {pedido.codigoRastreio && (
        <p className="mt-8 rounded-md bg-stone-50 p-4 text-sm">
          Código de rastreio: <strong className="font-mono">{pedido.codigoRastreio}</strong>{" "}
          <a className="underline" href={`https://rastreamento.correios.com.br/app/index.php?objeto=${encodeURIComponent(pedido.codigoRastreio)}`} target="_blank" rel="noopener">
            rastrear
          </a>
        </p>
      )}

      <section className="mt-10">
        <h2 className="mb-3 font-medium">Itens</h2>
        <ul className="divide-y divide-stone-200 border-y border-stone-200 text-sm">
          {itens.map((i) => (
            <li key={i.id} className="flex justify-between py-3">
              <span>
                {i.quantidade}× {i.produtoNome}
                {i.varianteNome !== "Padrão" && <span className="text-stone-500"> ({i.varianteNome})</span>}
              </span>
              <span>{formatarReais(i.precoUnitCentavos * i.quantidade)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatarReais(pedido.subtotalCentavos)}</dd></div>
          {pedido.descontoCentavos > 0 && (
            <div className="flex justify-between text-green-700"><dt>Desconto{pedido.cupomCodigo ? ` (${pedido.cupomCodigo})` : ""}</dt><dd>− {formatarReais(pedido.descontoCentavos)}</dd></div>
          )}
          {pedido.descontoPixCentavos > 0 && (
            <div className="flex justify-between text-green-700"><dt>Desconto no Pix</dt><dd className="tabular-nums">− {formatarReais(pedido.descontoPixCentavos)}</dd></div>
          )}
          <div className="flex justify-between"><dt>{pedido.entrega.descricao}</dt><dd>{pedido.freteCentavos ? formatarReais(pedido.freteCentavos) : "Grátis"}</dd></div>
          <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd>{formatarReais(pedido.totalCentavos)}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-stone-500">Pagamento: {NOMES_PAGAMENTO[pedido.formaPagamento]}</p>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 font-medium">Histórico</h2>
        <ul className="space-y-2 text-sm">
          {historico.map((h) => (
            <li key={h.id} className="flex gap-3">
              <span className="w-32 shrink-0 text-stone-500">{formatarDataHora(h.criadoEm)}</span>
              <span>
                {NOMES_STATUS[h.status]}
                {/* as outras notas são internas da loja */}
                {h.status === "enviado" && h.nota && <span className="block text-stone-500">{h.nota}</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
