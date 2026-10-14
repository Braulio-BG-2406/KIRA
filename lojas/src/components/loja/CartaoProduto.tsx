import Link from "next/link";
import type { ProdutoVitrine } from "@/lib/catalogo";
import { FotoProduto } from "./FotoProduto";
import { Preco } from "./Preco";

export function CartaoProduto({ p, base }: { p: ProdutoVitrine; base: string }) {
  const esgotado = p.estoqueTotal <= 0;
  const promocao = p.precoDe != null;
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
      <h3 className="mt-3 text-sm text-stone-800 group-hover:underline">{p.nome}</h3>
      <div className="mt-1">
        <Preco min={p.precoMin} max={p.precoMax} de={p.precoDe} />
      </div>
    </Link>
  );
}

export function GradeProdutos({ produtos, base }: { produtos: ProdutoVitrine[]; base: string }) {
  if (produtos.length === 0) return <p className="py-10 text-center text-stone-500">Nenhum produto por aqui ainda.</p>;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {produtos.map((p) => (
        <CartaoProduto key={p.id} p={p} base={base} />
      ))}
    </div>
  );
}
