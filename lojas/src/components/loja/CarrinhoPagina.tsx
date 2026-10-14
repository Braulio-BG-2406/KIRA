"use client";

import Link from "next/link";
import { formatarReais } from "@/lib/dinheiro";
import { lerCarrinho, salvarCarrinho } from "./carrinho";
import { useItensDoCarrinho } from "./useItens";
import { FotoProduto } from "./FotoProduto";

export function CarrinhoPagina({ slug, base }: { slug: string; base: string }) {
  const { linhas, validas, subtotal, carregando, vazio } = useItensDoCarrinho(slug);

  function mudar(varianteId: number, quantidade: number) {
    salvarCarrinho(slug, lerCarrinho(slug).map((i) => (i.varianteId === varianteId ? { ...i, quantidade } : i)));
  }

  if (vazio) {
    return (
      <div className="py-16 text-center">
        <p className="text-stone-600">Seu carrinho está vazio.</p>
        <Link href={base || "/"} className="botao-primario mt-6">
          Ver produtos
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
      <ul className="divide-y divide-stone-200 border-y border-stone-200">
        {linhas.map((l) => {
          const i = l.info;
          const indisponivel = i && (!i.disponivel || i.estoque <= 0);
          const acimaDoEstoque = i && !indisponivel && l.quantidade > i.estoque;
          return (
            <li key={l.varianteId} className="flex gap-4 py-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-stone-100">
                <FotoProduto url={i?.imagem} nome={i?.produtoNome ?? "…"} />
              </div>
              <div className="min-w-0 flex-1">
                {i ? (
                  <Link href={`${base}/produto/${i.produtoSlug}`} className="font-medium hover:underline">
                    {i.produtoNome}
                  </Link>
                ) : (
                  <span className="text-stone-400">{carregando ? "Carregando…" : "Produto indisponível"}</span>
                )}
                {i && i.varianteNome !== "Padrão" && <p className="text-sm text-stone-500">{i.varianteNome}</p>}
                {indisponivel && <p className="text-sm text-red-600">Esgotado. Remova para continuar.</p>}
                {acimaDoEstoque && <p className="text-sm text-amber-700">Só temos {i.estoque}. Vamos considerar essa quantidade.</p>}
                <div className="mt-2 flex items-center gap-3">
                  <select
                    value={l.quantidade}
                    onChange={(e) => mudar(l.varianteId, Number(e.target.value))}
                    className="campo w-20 py-1"
                    aria-label="Quantidade"
                    disabled={!!indisponivel}
                  >
                    {Array.from({ length: Math.max(l.quantidade, Math.min(i?.estoque ?? 10, 20)) }, (_, n) => n + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => mudar(l.varianteId, 0)} className="text-sm text-stone-500 underline">
                    Remover
                  </button>
                </div>
              </div>
              {i && <p className="font-medium">{formatarReais(i.precoCentavos * l.quantidade)}</p>}
            </li>
          );
        })}
      </ul>
      <aside className="h-fit rounded-lg bg-stone-50 p-5">
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span className="font-semibold">{formatarReais(subtotal)}</span>
        </div>
        <p className="mt-2 text-xs text-stone-500">Frete e cupom na próxima etapa.</p>
        {validas.length > 0 && !carregando ? (
          <Link href={`${base}/checkout`} className="mt-5 block rounded-md bg-marca py-3 text-center font-medium text-white hover:opacity-90">
            Finalizar compra
          </Link>
        ) : (
          <button disabled className="mt-5 w-full rounded-md bg-marca py-3 font-medium text-white opacity-50">
            Finalizar compra
          </button>
        )}
        <Link href={base || "/"} className="mt-3 block text-center text-sm text-stone-600 underline">
          Continuar comprando
        </Link>
      </aside>
    </div>
  );
}
