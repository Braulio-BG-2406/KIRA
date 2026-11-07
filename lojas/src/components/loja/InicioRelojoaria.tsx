import Link from "next/link";
import type { Loja } from "@/db/schema";
import type { ProdutoVitrine } from "@/lib/catalogo";
import { formatarReais } from "@/lib/dinheiro";
import { parcela, precoNoPix } from "@/lib/precos";
import type { Categoria } from "./tipos";
import { CarrosselProdutos, GradeProdutos } from "./CartaoProduto";
import { DesenhoRelogio } from "./DesenhoRelogio";
import { Ordenar } from "./Ordenar";

type Props = {
  loja: Loja;
  base: string;
  categorias: (Categoria & { capa?: string; total: number })[];
  destaques: ProdutoVitrine[];
  todos: ProdutoVitrine[];
  ordem?: string;
};

function Icone({ d }: { d: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** foto da peça ou, sem foto, o relógio desenhado em traço fino */
function Peca({ src, nome, escuro = false, className = "" }: { src?: string; nome: string; escuro?: boolean; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={nome} className={`h-full w-full object-cover ${className}`} />;
  }
  return (
    <div role="img" aria-label={nome} className={`flex h-full w-full items-center justify-center ${className}`}>
      <DesenhoRelogio traco={0.8} className={`h-[62%] w-auto ${escuro ? "text-destaque/80" : "text-stone-800/70"}`} />
    </div>
  );
}

/**
 * Página inicial no espírito das grandes relojoarias: fundo claro e quente, letra fina e grande,
 * muito espaço, peças em destaque e uma faixa escura com a ficha técnica.
 */
export function InicioRelojoaria({ loja, base, categorias, destaques, todos, ordem }: Props) {
  const idsRelogios = new Set(categorias.filter((c) => /rel[oó]gio/i.test(c.nome)).map((c) => c.id));
  const ehRelogio = (p: ProdutoVitrine) => (p.categoriaId != null && idsRelogios.has(p.categoriaId)) || /^rel[oó]gio/i.test(p.nome);
  const candidatos = [...(destaques.length ? destaques : todos)].filter((p) => p.estoqueTotal > 0).sort((a, b) => b.precoMin - a.precoMin);
  // abertura: o relógio mais valioso em destaque (de preferência com foto)
  const capa =
    candidatos.find((p) => ehRelogio(p) && p.imagens.length) ?? candidatos.find(ehRelogio) ?? candidatos.find((p) => p.imagens.length) ?? candidatos[0] ?? todos[0];
  // faixa escura: outro relógio, com ficha técnica
  const comFicha = [...destaques, ...todos].filter((p) => p.id !== capa?.id && p.especificacoes.length >= 3);
  const editorial = comFicha.find(ehRelogio) ?? comFicha[0];
  const categoriaCapa = categorias.find((c) => c.id === capa?.categoriaId);
  const selecao = (destaques.length >= 3 ? destaques : todos).filter((p) => p.id !== capa?.id).slice(0, 10);
  const instagram = loja.instagram?.replace(/^@/, "");
  const pix = loja.pixChave && loja.descontoPixPct > 0;
  const gratis = loja.frete.entrega.ativo ? loja.frete.entrega.gratisAcimaCentavos : null;
  const servicos = [
    { icone: "M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3Zm-3 9 2 2 4-4", titulo: "Garantia", texto: "Relógios com garantia contra defeito de fabricação e nota fiscal." },
    {
      icone: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
      titulo: "Entrega",
      texto: gratis != null ? `Para todo o Brasil, com rastreio. Grátis acima de ${formatarReais(gratis)}.` : "Para todo o Brasil, com código de rastreio.",
    },
    {
      icone: "M3 6h18v12H3zM3 10h18M7 15h3",
      titulo: "Pagamento",
      texto: [pix ? `${loja.descontoPixPct}% de desconto no Pix` : "Pix", loja.parcelasSemJuros > 1 ? `até ${loja.parcelasSemJuros}x sem juros no cartão` : "cartão"].join(" ou ") + ".",
    },
    { icone: "M4 12a8 8 0 1 0 2.3-5.6M4 4v3h3", titulo: "Troca e devolução", texto: "Até 7 dias depois de receber, sem complicação." },
  ];

  return (
    <>
      {/* abertura */}
      {capa && (
        <section className="bg-areia bg-[radial-gradient(circle_at_50%_30%,#ffffff_0%,#f4f1ec_55%)] md:bg-[radial-gradient(circle_at_74%_50%,#ffffff_0%,#f4f1ec_42%)]">
          <div className="mx-auto grid max-w-[1440px] md:min-h-[calc(100svh-110px)] md:grid-cols-2">
            <div className="order-2 flex flex-col justify-center px-6 pb-16 pt-6 text-center sm:px-12 md:order-1 md:px-16 md:py-16 md:text-left lg:px-24">
              <p className="sobrelinha text-destaque">{[categoriaCapa?.nome, capa.marca].filter(Boolean).join(" · ") || loja.nome}</p>
              <h1 className="mt-6 font-titulo text-[2.75rem] leading-[1.04] text-stone-950 sm:text-6xl xl:text-[4.25rem]">{capa.nome}</h1>
              {capa.descricao && <p className="mx-auto mt-6 max-w-md text-lg font-light leading-relaxed text-stone-600 md:mx-0">{capa.descricao}</p>}
              <p className="mt-8 text-[15px] font-light text-stone-600">
                {capa.precoMax !== capa.precoMin && "a partir de "}
                <span className="text-stone-950">{formatarReais(capa.precoMin)}</span>
                {pix && <span> · {formatarReais(precoNoPix(capa.precoMin, loja.descontoPixPct))} no Pix</span>}
              </p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-8 md:justify-start">
                <Link href={`${base}/produto/${capa.slug}`} className="pilula-escura">
                  Descobrir
                </Link>
                {categoriaCapa && (
                  <Link href={`${base}/categoria/${categoriaCapa.slug}`} className="link-seta text-stone-800">
                    Ver todos os {categoriaCapa.nome.toLowerCase()} <span aria-hidden>→</span>
                  </Link>
                )}
              </div>
            </div>
            {/* a peça fica por cima: a altura vem da coluna de texto */}
            <div className="relative order-1 aspect-square md:order-2 md:aspect-auto">
              <div className="absolute inset-0">
                <Peca src={capa.imagens[0]} nome={capa.nome} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* apresentação */}
      {loja.sobre && (
        <section className="mx-auto max-w-4xl px-6 py-24 text-center sm:py-32">
          <p className="sobrelinha text-stone-500">{loja.nome}</p>
          <p className="mt-8 font-titulo text-2xl leading-snug text-stone-900 sm:text-4xl">{loja.sobre}</p>
        </section>
      )}

      {/* coleções */}
      {categorias.length > 0 && (
        <section className="mx-auto max-w-[1440px] px-5 sm:px-10">
          <div className="mb-10 flex items-end justify-between gap-6">
            <h2 className="font-titulo text-3xl text-stone-950 sm:text-4xl">Coleções</h2>
            <Link href="#produtos" className="link-seta text-stone-700">
              Ver todos os modelos <span aria-hidden>→</span>
            </Link>
          </div>
          <div className="sem-barra -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 sm:-mx-10 sm:scroll-px-10 sm:px-10 lg:gap-5">
            {categorias.map((c) => (
              <Link key={c.id} href={`${base}/categoria/${c.slug}`} className="group w-[62%] shrink-0 snap-start sm:w-[34%] lg:w-[calc(20%-16px)]">
                <div className="aspect-[3/4] overflow-hidden bg-areia">
                  <Peca src={c.capa} nome={c.nome} className="transition duration-700 ease-out group-hover:scale-[1.03]" />
                </div>
                <p className="mt-4 text-[17px] font-light text-stone-900">{c.nome}</p>
                <p className="mt-0.5 text-[13px] font-light text-stone-500">
                  {c.total} {c.total === 1 ? "modelo" : "modelos"}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* seleção */}
      {selecao.length > 0 && (
        <section className="mx-auto max-w-[1440px] px-5 pt-28 sm:px-10">
          <div className="mb-10 text-center">
            <p className="sobrelinha text-destaque">Seleção</p>
            <h2 className="mt-4 font-titulo text-3xl text-stone-950 sm:text-4xl">Os mais desejados</h2>
          </div>
          <CarrosselProdutos produtos={selecao} base={base} condicoes={loja} />
        </section>
      )}

      {/* faixa escura com a ficha técnica */}
      {editorial && (
        <section className="mt-28 bg-[#141414] text-white">
          <div className="mx-auto grid max-w-[1440px] md:grid-cols-2">
            <div className="relative aspect-square bg-[radial-gradient(circle_at_50%_45%,#2b2b2b_0%,#141414_65%)] md:aspect-auto md:min-h-[640px]">
              <div className="absolute inset-0">
                <Peca src={editorial.imagens[0]} nome={editorial.nome} escuro />
              </div>
            </div>
            <div className="flex flex-col justify-center px-6 py-16 sm:px-12 lg:px-20">
              <p className="sobrelinha text-destaque">{editorial.marca ?? "Em detalhe"}</p>
              <h2 className="mt-5 font-titulo text-4xl leading-tight sm:text-5xl">{editorial.nome}</h2>
              {editorial.descricao && <p className="mt-6 max-w-lg text-[17px] font-light leading-relaxed text-white/65">{editorial.descricao}</p>}
              <dl className="mt-10 max-w-lg">
                {editorial.especificacoes.slice(0, 5).map((e) => (
                  <div key={e.nome} className="flex justify-between gap-6 border-t border-white/12 py-3.5 text-[15px]">
                    <dt className="font-light text-white/50">{e.nome}</dt>
                    <dd className="text-right font-light">{e.valor}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-10 flex flex-wrap items-center gap-6">
                <Link href={`${base}/produto/${editorial.slug}`} className="pilula-clara text-white">
                  Conhecer · {formatarReais(editorial.precoMin)}
                </Link>
                {(() => {
                  const parc = parcela(editorial.precoMin, loja.parcelasSemJuros);
                  return parc && <span className="text-[13px] font-light text-white/50">ou {parc.vezes}x de {formatarReais(parc.valor)} sem juros</span>;
                })()}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* todos os modelos */}
      <section id="produtos" className="mx-auto max-w-[1440px] scroll-mt-28 px-5 pt-28 sm:px-10">
        <div className="mb-8 text-center">
          <h2 className="font-titulo text-3xl text-stone-950 sm:text-4xl">Todos os modelos</h2>
        </div>
        <div className="mb-12 flex flex-wrap items-center justify-between gap-4 border-y border-stone-200 py-4">
          <div className="sem-barra -mx-1 flex gap-2 overflow-x-auto px-1">
            {categorias.map((c) => (
              <Link key={c.id} href={`${base}/categoria/${c.slug}`} className="whitespace-nowrap rounded-full border border-stone-300 px-4 py-1.5 text-[13px] font-light text-stone-700 transition hover:border-stone-900 hover:text-stone-950">
                {c.nome}
              </Link>
            ))}
          </div>
          <Ordenar atual={ordem} />
        </div>
        <GradeProdutos produtos={todos} base={base} condicoes={loja} variante="relojoaria" />
      </section>

      {/* serviços */}
      <section className="mt-28 bg-areia">
        <ul className="mx-auto grid max-w-[1440px] gap-12 px-6 py-20 sm:grid-cols-2 sm:px-10 lg:grid-cols-4">
          {servicos.map((s) => (
            <li key={s.titulo} className="text-center">
              <span className="inline-block text-destaque">
                <Icone d={s.icone} />
              </span>
              <p className="mt-4 text-[17px] font-light text-stone-950">{s.titulo}</p>
              <p className="mx-auto mt-2 max-w-60 text-sm font-light leading-relaxed text-stone-600">{s.texto}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Instagram */}
      {instagram && (
        <section className="mx-auto max-w-3xl px-6 py-28 text-center">
          <p className="sobrelinha text-stone-500">Lançamentos e bastidores</p>
          <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noopener" className="mt-6 block font-titulo text-3xl text-stone-950 transition hover:text-destaque sm:text-5xl">
            @{instagram}
          </a>
          <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noopener" className="link-seta mt-10 text-stone-700">
            Seguir no Instagram <span aria-hidden>→</span>
          </a>
        </section>
      )}
    </>
  );
}
