"use client";

import { useState } from "react";
import Link from "next/link";
import { formatarReais } from "@/lib/dinheiro";
import { parcela, precoNoPix } from "@/lib/precos";
import { adicionarAoCarrinho, useCarrinho } from "./carrinho";

type V = { id: number; nome: string; precoCentavos: number; precoDeCentavos: number | null; estoque: number };

export function Comprar({
  slug,
  base,
  variantes,
  descontoPixPct = 0,
  parcelasSemJuros = 1,
  refinado = false,
  joalheria = false,
}: {
  slug: string;
  base: string;
  variantes: V[];
  descontoPixPct?: number;
  parcelasSemJuros?: number;
  /** visual de relojoaria: letra fina e botões arredondados */
  refinado?: boolean;
  /** visual escuro com dourado (Infinite): botões "Adicionar à sacola" e "Comprar agora" */
  joalheria?: boolean;
}) {
  const primeiraDisponivel = variantes.find((v) => v.estoque > 0) ?? variantes[0];
  const [varianteId, setVarianteId] = useState(primeiraDisponivel.id);
  const [quantidade, setQuantidade] = useState(1);
  const [adicionado, setAdicionado] = useState(false);
  const carrinho = useCarrinho(slug);
  const v = variantes.find((x) => x.id === varianteId) ?? primeiraDisponivel;
  const noCarrinho = carrinho.find((i) => i.varianteId === v.id)?.quantidade ?? 0;
  const disponivel = Math.max(0, v.estoque - noCarrinho);
  const unicaPadrao = variantes.length === 1 && variantes[0].nome === "Padrão";

  function adicionar() {
    adicionarAoCarrinho(slug, v.id, Math.min(quantidade, disponivel));
    setAdicionado(true);
    setQuantidade(1);
  }

  if (joalheria) {
    const parc = parcela(v.precoCentavos, parcelasSemJuros);
    return (
      <div className="space-y-6">
        <div className="painel-j px-5 py-4">
          <div className="flex flex-wrap items-baseline gap-x-3">
            {v.precoDeCentavos != null && v.precoDeCentavos > v.precoCentavos && (
              <span className="text-[#8a857c] line-through">{formatarReais(v.precoDeCentavos)}</span>
            )}
            <span className="text-[28px] font-semibold leading-tight text-[#f3efe6]">{formatarReais(v.precoCentavos)}</span>
          </div>
          {descontoPixPct > 0 && (
            <p className="mt-1 text-[14px] text-[#c2bdb4]">
              <strong className="font-medium text-[#f3efe6]">{formatarReais(precoNoPix(v.precoCentavos, descontoPixPct))}</strong> no Pix ({descontoPixPct}% de desconto)
            </p>
          )}
          <p className="mt-0.5 text-[14px] text-[#c2bdb4]">
            {parc ? `ou ${parc.vezes}x de ${formatarReais(parc.valor)} sem juros no cartão` : "Pix, cartão de crédito ou boleto"}
          </p>
        </div>

        {!unicaPadrao && (
          <fieldset>
            <legend className="mb-3 text-[14px] text-[#f3efe6]">Escolha a opção</legend>
            <div className="flex flex-wrap gap-2">
              {variantes.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => {
                    setVarianteId(x.id);
                    setAdicionado(false);
                  }}
                  disabled={x.estoque <= 0}
                  aria-pressed={x.id === v.id}
                  className={`rounded-full border px-4 py-2 text-[14px] transition disabled:cursor-not-allowed disabled:line-through disabled:opacity-40 ${
                    x.id === v.id ? "border-[#b89a67] bg-[#b89a67]/12 text-[#f3efe6]" : "border-[#30302d] text-[#c2bdb4] hover:border-[#f3efe6]/50"
                  }`}
                >
                  {x.nome}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {v.estoque <= 0 ? (
          <p className="painel-j px-5 py-4 text-[14px] text-[#c2bdb4]">Esgotado no momento. Chame no WhatsApp para saber quando volta.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-[14px] text-[#c2bdb4]">Quantidade</span>
              <div className="flex items-center rounded-[10px] border border-[#30302d]">
                <button type="button" className="px-4 py-2.5 text-[#c2bdb4] hover:text-[#f3efe6]" onClick={() => setQuantidade((q) => Math.max(1, q - 1))} aria-label="Diminuir quantidade">
                  −
                </button>
                <span className="w-8 text-center text-[#f3efe6]" aria-live="polite">
                  {quantidade}
                </span>
                <button
                  type="button"
                  className="px-4 py-2.5 text-[#c2bdb4] hover:text-[#f3efe6]"
                  onClick={() => setQuantidade((q) => Math.min(disponivel || 1, q + 1))}
                  aria-label="Aumentar quantidade"
                >
                  +
                </button>
              </div>
              <span className="text-[13px] text-[#8a857c]">{v.estoque <= 3 ? `Só ${v.estoque} em estoque` : "Em estoque"}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={adicionar} disabled={disponivel <= 0} className="botao-ouro py-3.5">
                {disponivel <= 0 ? "Todo o estoque já está na sacola" : "Adicionar à sacola"}
              </button>
              <button
                type="button"
                disabled={disponivel <= 0 && noCarrinho === 0}
                onClick={() => {
                  if (disponivel > 0) adicionarAoCarrinho(slug, v.id, Math.min(quantidade, disponivel));
                  window.location.href = `${base}/checkout`;
                }}
                className="botao-contorno py-3.5"
              >
                Comprar agora
              </button>
            </div>
          </>
        )}

        {adicionado && (
          <div className="flex items-center justify-between rounded-[10px] border border-[#b89a67]/40 px-4 py-3 text-[14px] text-[#f3efe6]" role="status">
            Adicionado à sacola.
            <Link href={`${base}/carrinho`} className="font-medium text-[#c5a978] underline underline-offset-4">
              Ver sacola
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline gap-x-3">
        {v.precoDeCentavos != null && v.precoDeCentavos > v.precoCentavos && (
          <span className="text-stone-400 line-through">{formatarReais(v.precoDeCentavos)}</span>
        )}
        <span className={refinado ? "text-2xl font-light text-stone-950" : "text-3xl font-semibold text-marca"}>{formatarReais(v.precoCentavos)}</span>
      </div>
      {(descontoPixPct > 0 || parcela(v.precoCentavos, parcelasSemJuros)) && (
        <div className={`-mt-3 space-y-0.5 text-sm ${refinado ? "font-light" : ""}`}>
          {descontoPixPct > 0 && (
            <p className={refinado ? "text-stone-700" : "text-green-700"}>
              <strong>{formatarReais(precoNoPix(v.precoCentavos, descontoPixPct))}</strong> no Pix ({descontoPixPct}% de desconto)
            </p>
          )}
          {(() => {
            const parc = parcela(v.precoCentavos, parcelasSemJuros);
            return parc && <p className="text-stone-600">ou {parc.vezes}x de {formatarReais(parc.valor)} sem juros no cartão</p>;
          })()}
        </div>
      )}

      {!unicaPadrao && (
        <fieldset>
          <legend className={refinado ? "sobrelinha mb-3 text-stone-500" : "rotulo"}>Opção</legend>
          <div className="flex flex-wrap gap-2">
            {variantes.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => {
                  setVarianteId(x.id);
                  setAdicionado(false);
                }}
                disabled={x.estoque <= 0}
                aria-pressed={x.id === v.id}
                className={`border text-sm transition disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through ${
                  refinado ? "rounded-full px-5 py-2 font-light" : "rounded-md px-4 py-2"
                } ${x.id === v.id ? (refinado ? "border-stone-950 bg-stone-950 text-white" : "border-marca bg-marca text-white") : refinado ? "border-stone-300 hover:border-stone-950" : "border-stone-300 hover:border-marca"}`}
              >
                {x.nome}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {v.estoque <= 0 ? (
        <p className="rounded-md bg-stone-100 px-4 py-3 text-sm text-stone-600">Esgotado no momento.</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className={`flex items-center border border-stone-300 ${refinado ? "rounded-full px-1" : "rounded-md"}`}>
              <button type="button" className="px-3 py-2" onClick={() => setQuantidade((q) => Math.max(1, q - 1))} aria-label="Diminuir">
                −
              </button>
              <span className="w-8 text-center" aria-live="polite">{quantidade}</span>
              <button type="button" className="px-3 py-2" onClick={() => setQuantidade((q) => Math.min(disponivel || 1, q + 1))} aria-label="Aumentar">
                +
              </button>
            </div>
            {v.estoque <= 3 && <span className="text-xs text-destaque">Últimas {v.estoque} unidade(s)</span>}
          </div>
          <button
            type="button"
            onClick={adicionar}
            disabled={disponivel <= 0}
            className={refinado ? "pilula-escura w-full py-4" : "w-full rounded-md bg-marca py-3.5 font-medium text-white hover:opacity-90 disabled:opacity-50"}
          >
            {disponivel <= 0 ? "Você já tem todo o estoque no carrinho" : refinado ? "Adicionar à sacola" : "Adicionar ao carrinho"}
          </button>
        </>
      )}

      {adicionado && (
        <div
          className={`flex items-center justify-between px-4 py-3 text-sm ${refinado ? "rounded-full bg-areia px-6 font-light text-stone-800" : "rounded-md border border-green-200 bg-green-50 text-green-800"}`}
          role="status"
        >
          {refinado ? "Adicionado à sacola." : "Adicionado ao carrinho."}
          <Link href={`${base}/carrinho`} className="font-medium underline">
            {refinado ? "Ver sacola" : "Ver carrinho"}
          </Link>
        </div>
      )}
    </div>
  );
}
