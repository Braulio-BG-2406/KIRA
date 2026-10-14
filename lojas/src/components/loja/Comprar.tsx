"use client";

import { useState } from "react";
import Link from "next/link";
import { formatarReais } from "@/lib/dinheiro";
import { adicionarAoCarrinho, useCarrinho } from "./carrinho";

type V = { id: number; nome: string; precoCentavos: number; precoDeCentavos: number | null; estoque: number };

export function Comprar({ slug, base, variantes }: { slug: string; base: string; variantes: V[] }) {
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
        <span className="text-3xl font-semibold text-marca">{formatarReais(v.precoCentavos)}</span>
      </div>

      {!unicaPadrao && (
        <fieldset>
          <legend className="rotulo">Opção</legend>
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
                className={`rounded-md border px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through ${
                  x.id === v.id ? "border-marca bg-marca text-white" : "border-stone-300 hover:border-marca"
                }`}
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
            <div className="flex items-center rounded-md border border-stone-300">
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
          <button type="button" onClick={adicionar} disabled={disponivel <= 0} className="w-full rounded-md bg-marca py-3.5 font-medium text-white hover:opacity-90 disabled:opacity-50">
            {disponivel <= 0 ? "Você já tem todo o estoque no carrinho" : "Adicionar ao carrinho"}
          </button>
        </>
      )}

      {adicionado && (
        <div className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
          Adicionado ao carrinho.
          <Link href={`${base}/carrinho`} className="font-medium underline">
            Ver carrinho
          </Link>
        </div>
      )}
    </div>
  );
}
