import Link from "next/link";
import type { ProdutoVitrine } from "@/lib/catalogo";
import { formatarReais } from "@/lib/dinheiro";
import { parcela, precoNoPix } from "@/lib/precos";
import { FotoProduto } from "./FotoProduto";
import { Preco } from "./Preco";

export type CondicoesLoja = { descontoPixPct: number; parcelasSemJuros: number };

export type VarianteCartao = "padrao" | "relojoaria";

export function CartaoProduto({ p, base, condicoes, variante = "padrao" }: { p: ProdutoVitrine; base: string; condicoes: CondicoesLoja; variante?: VarianteCartao }) {
  const esgotado = p.estoqueTotal <= 0;
  const promocao = p.precoDe != null;
  const parc = parcela(p.precoMin, condicoes.parcelasSemJuros);
  if (variante === "relojoaria") {
    // vitrine de relojoaria: foto em fundo claro, texto centralizado, opções contadas
    const opcoes = p.variantes.length;
    return (
      <Link href={`${base}/produto/${p.slug}`} className="group block text-center">
        <div className="relative aspect-[4/5] overflow-hidden bg-[#efeeea]">
          <FotoProduto url={p.imagens[0]} nome={p.nome} className="transition duration-500 group-hover:scale-[1.04]" />
          {esgotado ? (
            <span className="absolute left-3 top-3 bg-black/80 px-2 py-1 text-[10px] uppercase tracking-widest text-white">Esgotado</span>
          ) : promocao ? (
            <span className="absolute left-3 top-3 bg-destaque px-2 py-1 text-[10px] uppercase tracking-widest text-black">Oferta</span>
          ) : null}
          <span className="absolute inset-x-0 bottom-0 translate-y-full bg-black/85 py-2.5 text-[11px] uppercase tracking-[0.2em] text-white transition duration-300 group-hover:translate-y-0">
            Ver detalhes
          </span>
        </div>
        {p.marca && <p className="mt-4 text-[10px] uppercase tracking-[0.25em] text-stone-500">{p.marca}</p>}
        <h3 className={`${p.marca ? "mt-1" : "mt-4"} text-sm font-medium uppercase tracking-wide text-stone-900`}>{p.nome}</h3>
        {opcoes > 1 && <p className="mt-0.5 text-xs text-stone-500">{opcoes} opções</p>}
        <div className="mt-2 flex justify-center">
          <Preco min={p.precoMin} max={p.precoMax} de={p.precoDe} />
        </div>
        {!esgotado && condicoes.descontoPixPct > 0 && (
          <p className="text-xs text-green-700">{formatarReais(precoNoPix(p.precoMin, condicoes.descontoPixPct))} no Pix</p>
        )}
        {!esgotado && parc && <p className="text-xs text-stone-500">ou {parc.vezes}x de {formatarReais(parc.valor)}</p>}
      </Link>
    );
  }
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

export function GradeProdutos({
  produtos,
  base,
  condicoes,
  variante = "padrao",
}: {
  produtos: ProdutoVitrine[];
  base: string;
  condicoes: CondicoesLoja;
  variante?: VarianteCartao;
}) {
  if (produtos.length === 0) return <p className="py-10 text-center text-stone-500">Nenhum produto por aqui ainda.</p>;
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 ${variante === "relojoaria" ? "gap-x-3 gap-y-10 sm:gap-x-6" : "gap-x-4 gap-y-8"}`}>
      {produtos.map((p) => (
        <CartaoProduto key={p.id} p={p} base={base} condicoes={condicoes} variante={variante} />
      ))}
    </div>
  );
}
