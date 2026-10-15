import Link from "next/link";
import type { ProdutoVitrine } from "@/lib/catalogo";
import { formatarReais } from "@/lib/dinheiro";
import { parcela, precoNoPix } from "@/lib/precos";
import { FotoProduto } from "./FotoProduto";
import { Preco } from "./Preco";
import { DesenhoRelogio } from "./DesenhoRelogio";

export type CondicoesLoja = { descontoPixPct: number; parcelasSemJuros: number };

export type VarianteCartao = "padrao" | "relojoaria";

export function CartaoProduto({ p, base, condicoes, variante = "padrao" }: { p: ProdutoVitrine; base: string; condicoes: CondicoesLoja; variante?: VarianteCartao }) {
  const esgotado = p.estoqueTotal <= 0;
  const promocao = p.precoDe != null;
  const parc = parcela(p.precoMin, condicoes.parcelasSemJuros);
  if (variante === "relojoaria") {
    // vitrine de relojoaria: peça em fundo areia, texto fino e centralizado
    const opcoes = p.variantes.length;
    return (
      <Link href={`${base}/produto/${p.slug}`} className="group block text-center">
        <div className="relative aspect-[4/5] overflow-hidden bg-areia">
          {p.imagens[0] ? (
            <FotoProduto url={p.imagens[0]} nome={p.nome} className="transition duration-700 ease-out group-hover:scale-[1.03]" />
          ) : (
            <div role="img" aria-label={p.nome} className="flex h-full items-center justify-center">
              <DesenhoRelogio traco={0.9} className="h-[58%] w-auto text-stone-400 transition duration-700 group-hover:text-destaque" />
            </div>
          )}
          {esgotado ? (
            <span className="sobrelinha absolute left-4 top-4 text-stone-500">Esgotado</span>
          ) : p.estoqueTotal === 1 ? (
            <span className="sobrelinha absolute left-4 top-4 text-destaque">Última unidade</span>
          ) : promocao ? (
            <span className="sobrelinha absolute left-4 top-4 text-destaque">Oferta</span>
          ) : null}
        </div>
        <div className="px-2 pt-5">
          {p.marca && <p className="sobrelinha text-[10px] text-stone-500">{p.marca}</p>}
          <h3 className="mt-1.5 text-[15px] font-normal text-stone-900">{p.nome}</h3>
          {opcoes > 1 && <p className="mt-0.5 text-xs font-light text-stone-500">{opcoes} opções</p>}
          <p className="mt-2 text-sm font-light text-stone-700">
            {p.precoDe != null && <span className="mr-2 text-stone-400 line-through">{formatarReais(p.precoDe)}</span>}
            {p.precoMax !== p.precoMin && "a partir de "}
            {formatarReais(p.precoMin)}
          </p>
          {!esgotado && condicoes.descontoPixPct > 0 && (
            <p className="mt-0.5 text-xs font-light text-stone-500">{formatarReais(precoNoPix(p.precoMin, condicoes.descontoPixPct))} no Pix</p>
          )}
          {!esgotado && parc && <p className="text-xs font-light text-stone-400">ou {parc.vezes}x de {formatarReais(parc.valor)}</p>}
        </div>
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
    <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 ${variante === "relojoaria" ? "gap-x-3 gap-y-14 sm:gap-x-5" : "gap-x-4 gap-y-8"}`}>
      {produtos.map((p) => (
        <CartaoProduto key={p.id} p={p} base={base} condicoes={condicoes} variante={variante} />
      ))}
    </div>
  );
}

/** fileira que rola de lado, como as vitrines das relojoarias */
export function CarrosselProdutos({ produtos, base, condicoes }: { produtos: ProdutoVitrine[]; base: string; condicoes: CondicoesLoja }) {
  return (
    <div className="sem-barra -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-2 sm:-mx-10 sm:scroll-px-10 sm:px-10 lg:gap-5">
      {produtos.map((p) => (
        <div key={p.id} className="w-[72%] shrink-0 snap-start sm:w-[42%] lg:w-[calc(25%-15px)]">
          <CartaoProduto p={p} base={base} condicoes={condicoes} variante="relojoaria" />
        </div>
      ))}
    </div>
  );
}
