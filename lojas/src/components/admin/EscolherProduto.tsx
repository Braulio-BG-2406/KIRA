"use client";

import { useState } from "react";
import { formatarReais } from "@/lib/dinheiro";
import { semAcentos } from "@/lib/texto";

export type OpcaoVariante = { id: number; nome: string; sku: string | null; precoCentavos: number; custoCentavos: number; estoque: number };

const normal = (s: string) => semAcentos(s).toLowerCase();

/** busca de produto para venda e compra */
export function EscolherProduto({ opcoes, aoEscolher, mostrarSemEstoque = false }: { opcoes: OpcaoVariante[]; aoEscolher: (v: OpcaoVariante) => void; mostrarSemEstoque?: boolean }) {
  const [busca, setBusca] = useState("");
  const termo = normal(busca.trim());
  const achados = termo
    ? opcoes.filter((o) => normal(`${o.nome} ${o.sku ?? ""}`).includes(termo) && (mostrarSemEstoque || o.estoque > 0)).slice(0, 8)
    : [];
  return (
    <div className="relative">
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar produto por nome ou SKU"
        className="campo"
        aria-label="Buscar produto"
      />
      {achados.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-stone-200 bg-white shadow-lg">
          {achados.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className="flex w-full justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-stone-50"
                onClick={() => {
                  aoEscolher(o);
                  setBusca("");
                }}
              >
                <span>
                  {o.nome}
                  {o.sku && <span className="ml-2 text-xs text-stone-400">{o.sku}</span>}
                </span>
                <span className="shrink-0 text-stone-500">
                  {formatarReais(o.precoCentavos)} · {o.estoque} un.
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {termo && achados.length === 0 && <p className="mt-1 text-xs text-stone-500">Nada encontrado{mostrarSemEstoque ? "" : " com estoque"}.</p>}
    </div>
  );
}
