import Link from "next/link";
import type { ProdutoVitrine } from "@/lib/catalogo";
import { formatarReais } from "@/lib/dinheiro";
import { parcela, precoNoPix } from "@/lib/precos";
import { FotoProduto } from "./FotoProduto";
import { Preco } from "./Preco";

export type CondicoesLoja = { descontoPixPct: number; parcelasSemJuros: number };

export function CartaoProduto({ p, base, condicoes }: { p: ProdutoVitrine; base: string; condicoes: CondicoesLoja }) {
  const esgotado = p.estoqueTotal <= 0;
  const promocao = p.precoDe != null;
  const parc = parcela(p.precoMin, condicoes.parcelasSemJuros);
  return (
    <Link href={`${base}/produto/${p.slug}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-stone-100">
        <FotoProduto url={p.imagens[0]} nome={p.nome} className="transition duration-300 group-hover:scale-105" />
        {esgotado ? (
          <span className="absolute left-2 top-2 rounded bg-stone-900/80 px-2 py-0.5 text-xs text-white">Esgotado</span>
        ) : promocao ? (
          <span className="absolute left-2 top-2 rounded bg-destaque px-2 py-0.5 text-xs font-medium text-white">Oferta</span>
        ) : null}
      </div>
      {p.marca && <p className="mt-3 text-[11px] uppercase tracking-widest text-stone-500">{p.marca}</p>}
      <h3 className={`${p.marca ? "mt-0.5" : "mt-3"} text-sm text-stone-800 group-hover:underline`}>{p.nome}</h3>
      <div className="mt-1">
        <Preco min={p.precoMin} max={p.precoMax} de={p.precoDe} />
      </div>
      {!esgotado && condicoes.descontoPixPct > 0 && (
        <p className="text-xs text-green-700">{formatarReais(precoNoPix(p.precoMin, condicoes.descontoPixPct))} no Pix</p>
      )}
      {!esgotado && parc && (
        <p className="text-xs text-stone-500">
          ou {parc.vezes}x de {formatarReais(parc.valor)} sem juros
        </p>
      )}
    </Link>
  );
}

export function GradeProdutos({ produtos, base, condicoes }: { produtos: ProdutoVitrine[]; base: string; condicoes: CondicoesLoja }) {
  if (produtos.length === 0) return <p className="py-10 text-center text-stone-500">Nenhum produto por aqui ainda.</p>;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {produtos.map((p) => (
        <CartaoProduto key={p.id} p={p} base={base} condicoes={condicoes} />
      ))}
    </div>
  );
}
