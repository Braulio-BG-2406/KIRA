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
}: {
  slug: string;
  base: string;
  variantes: V[];
  descontoPixPct?: number;
  parcelasSemJuros?: number;
  /** visual de relojoaria: letra fina e botões arredondados */
  refinado?: boolean;
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
