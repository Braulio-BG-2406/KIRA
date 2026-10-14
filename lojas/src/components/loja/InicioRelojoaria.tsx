import Link from "next/link";
import type { Loja } from "@/db/schema";
import type { ProdutoVitrine } from "@/lib/catalogo";
import { formatarReais } from "@/lib/dinheiro";
import { parcela, precoNoPix } from "@/lib/precos";
import type { Categoria } from "./tipos";
import { GradeProdutos } from "./CartaoProduto";
import { FotoProduto } from "./FotoProduto";
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
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** página inicial no estilo das relojoarias: abertura escura, coleções, vitrine e ficha técnica em destaque */
export function InicioRelojoaria({ loja, base, categorias, destaques, todos, ordem }: Props) {
  // abertura: o relógio mais valioso em destaque (de preferência com foto)
  const idsRelogios = new Set(categorias.filter((c) => /rel[oó]gio/i.test(c.nome)).map((c) => c.id));
  const ehRelogio = (p: ProdutoVitrine) => (p.categoriaId != null && idsRelogios.has(p.categoriaId)) || /^rel[oó]gio/i.test(p.nome);
  const candidatos = [...(destaques.length ? destaques : todos)].filter((p) => p.estoqueTotal > 0).sort((a, b) => b.precoMin - a.precoMin);
  const capa =
    candidatos.find((p) => ehRelogio(p) && p.imagens.length) ?? candidatos.find(ehRelogio) ?? candidatos.find((p) => p.imagens.length) ?? candidatos[0] ?? todos[0];
  // seção editorial: outro relógio, com ficha técnica
  const comFicha = [...destaques, ...todos].filter((p) => p.id !== capa?.id && p.especificacoes.length >= 3);
  const editorial = comFicha.find(ehRelogio) ?? comFicha[0];
  // grade sem buracos: em quantidade ímpar, a primeira coleção ocupa duas colunas
  const n = Math.min(categorias.length, 8);
  const colunas = n <= 4 ? (n === 3 ? "lg:grid-cols-3" : n === 2 ? "lg:grid-cols-2" : "lg:grid-cols-4") : n === 5 || n === 6 ? "lg:grid-cols-3" : "lg:grid-cols-4";
  const primeiraLarga = n % 2 === 1 && n > 1;
  const vitrine = destaques.length >= 4 ? destaques.slice(0, Math.min(8, destaques.length - (destaques.length % 4))) : destaques;
  const categoriaCapa = categorias.find((c) => c.id === capa?.categoriaId);
  const gratis = loja.frete.entrega.ativo ? loja.frete.entrega.gratisAcimaCentavos : null;
  const instagram = loja.instagram?.replace(/^@/, "");
  const vantagens = [
    { icone: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z", titulo: gratis != null ? `Frete grátis acima de ${formatarReais(gratis)}` : "Envio para todo o Brasil", texto: "Com código de rastreio" },
    ...(loja.pixChave && loja.descontoPixPct > 0 ? [{ icone: "M12 3l9 9-9 9-9-9 9-9Zm0 5-4 4 4 4 4-4-4-4Z", titulo: `${loja.descontoPixPct}% off no Pix`, texto: "Aprovação na hora" }] : []),
    ...(loja.parcelasSemJuros > 1 ? [{ icone: "M3 6h18v12H3zM3 10h18M7 15h3", titulo: `Até ${loja.parcelasSemJuros}x sem juros`, texto: "No cartão de crédito" }] : []),
    { icone: "M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3Zm-3 9 2 2 4-4", titulo: "Compra garantida", texto: "Devolução em até 7 dias" },
  ];

  return (
    <>
      {/* abertura */}
      {capa && (
        <section className="relative overflow-hidden bg-[radial-gradient(ellipse_at_70%_45%,#2c2c30_0%,#141416_45%,#0a0a0b_100%)] text-white">
          <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 md:min-h-[78vh] md:grid-cols-2 md:py-0">
            <div className="order-2 md:order-1">
              <p className="text-[11px] uppercase tracking-[0.35em] text-destaque">{categoriaCapa?.nome ?? "Destaque"}{capa.marca ? ` · ${capa.marca}` : ""}</p>
              <h1 className="mt-4 font-titulo text-4xl leading-[1.05] sm:text-6xl">{capa.nome}</h1>
              {capa.descricao && <p className="mt-5 max-w-md text-base leading-relaxed text-white/70">{capa.descricao}</p>}
              <p className="mt-6 text-sm text-white/60">
                {capa.precoMax !== capa.precoMin ? "a partir de " : ""}
                <span className="text-2xl font-semibold text-white">{formatarReais(capa.precoMin)}</span>
                {loja.pixChave && loja.descontoPixPct > 0 && <span className="ml-3 text-destaque">{formatarReais(precoNoPix(capa.precoMin, loja.descontoPixPct))} no Pix</span>}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={`${base}/produto/${capa.slug}`} className="bg-destaque px-8 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-black hover:brightness-110">
                  Comprar
                </Link>
                {categoriaCapa && (
                  <Link href={`${base}/categoria/${categoriaCapa.slug}`} className="border border-white/40 px-8 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] hover:border-white">
                    Ver {categoriaCapa.nome.toLowerCase()}
                  </Link>
                )}
              </div>
            </div>
            <div className="relative order-1 mx-auto flex aspect-square w-full max-w-md items-center justify-center md:order-2 md:max-w-xl">
              <div className="absolute inset-[12%] rounded-full bg-destaque/10 blur-3xl" aria-hidden />
              {capa.imagens[0] ? (
                <div className="relative aspect-[4/5] h-[92%]">
                  <div className="absolute -inset-3 border border-destaque/40" aria-hidden />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={capa.imagens[0]} alt={capa.nome} className="relative h-full w-full object-cover shadow-2xl shadow-black/60" />
                </div>
              ) : (
                <DesenhoRelogio className="relative h-[85%] w-auto text-destaque" />
              )}
            </div>
          </div>
        </section>
      )}

      {/* vantagens */}
      <section className="border-b border-stone-200 bg-[#f6f5f2]">
        <ul className={`mx-auto grid max-w-7xl grid-cols-2 gap-y-6 px-4 py-7 ${vantagens.length > 3 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          {vantagens.map((v) => (
            <li key={v.titulo} className="flex items-center gap-3 px-2 text-stone-800">
              <span className="text-destaque">
                <Icone d={v.icone} />
              </span>
              <span>
                <span className="block text-[11px] font-semibold uppercase tracking-[0.14em]">{v.titulo}</span>
                <span className="block text-xs text-stone-500">{v.texto}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* coleções */}
      {categorias.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-16">
          <h2 className="text-center font-titulo text-2xl text-marca sm:text-3xl">Coleções</h2>
          <div className={`mt-8 grid grid-cols-2 gap-3 sm:gap-4 ${colunas}`}>
            {categorias.slice(0, 8).map((c, i) => (
              <Link
                key={c.id}
                href={`${base}/categoria/${c.slug}`}
                className={`group relative block overflow-hidden bg-[#141416] ${primeiraLarga && i === 0 ? "col-span-2 aspect-[16/10] lg:aspect-auto" : "aspect-[4/5]"}`}
              >
                {/* o conteúdo fica por cima: o tamanho do bloco vem só da grade */}
                {c.capa ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.capa} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-100" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <DesenhoRelogio className="h-1/2 w-auto text-destaque/40 transition duration-500 group-hover:text-destaque/70" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 pt-12 text-white">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em]">{c.nome}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-white/60 group-hover:text-destaque">
                    {c.total} {c.total === 1 ? "modelo" : "modelos"} →
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* destaques */}
      {destaques.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-20">
          <div className="mb-8 text-center">
            <p className="text-[11px] uppercase tracking-[0.35em] text-destaque">Seleção da casa</p>
            <h2 className="mt-2 font-titulo text-2xl text-marca sm:text-3xl">Mais desejados</h2>
          </div>
          <GradeProdutos produtos={vitrine} base={base} condicoes={loja} variante="relojoaria" />
        </section>
      )}

      {/* editorial com a ficha técnica */}
      {editorial && (
        <section className="mt-20 bg-marca text-white">
          <div className="mx-auto grid max-w-7xl items-center md:grid-cols-2">
            <div className="aspect-square bg-[#141416] md:aspect-auto md:h-full md:min-h-[560px]">
              <FotoProduto url={editorial.imagens[0]} nome={editorial.nome} escuro />
            </div>
            <div className="px-6 py-14 sm:px-12">
              <p className="text-[11px] uppercase tracking-[0.35em] text-destaque">{editorial.marca ?? "Em detalhe"}</p>
              <h2 className="mt-3 font-titulo text-3xl sm:text-4xl">{editorial.nome}</h2>
              {editorial.descricao && <p className="mt-5 max-w-lg leading-relaxed text-white/70">{editorial.descricao}</p>}
              <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-white/15 pt-8">
                {editorial.especificacoes.slice(0, 4).map((e) => (
                  <div key={e.nome}>
                    <dt className="text-[10px] uppercase tracking-[0.25em] text-white/50">{e.nome}</dt>
                    <dd className="mt-1 text-sm">{e.valor}</dd>
                  </div>
                ))}
              </dl>
              <Link href={`${base}/produto/${editorial.slug}`} className="mt-10 inline-block border border-destaque px-8 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-destaque hover:bg-destaque hover:text-black">
                Conhecer · {formatarReais(editorial.precoMin)}
              </Link>
              {(() => {
                const parc = parcela(editorial.precoMin, loja.parcelasSemJuros);
                return parc && <p className="mt-3 text-xs text-white/50">ou {parc.vezes}x de {formatarReais(parc.valor)} sem juros</p>;
              })()}
            </div>
          </div>
        </section>
      )}

      {/* todos */}
      <section id="produtos" className="mx-auto max-w-7xl scroll-mt-32 px-4 pt-20">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-titulo text-2xl text-marca sm:text-3xl">Todos os produtos</h2>
          <Ordenar atual={ordem} />
        </div>
        <GradeProdutos produtos={todos} base={base} condicoes={loja} variante="relojoaria" />
      </section>

      {/* Instagram */}
      {instagram && (
        <section className="mt-20 bg-[#f6f5f2]">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-14 text-center">
            <p className="text-[11px] uppercase tracking-[0.35em] text-stone-500">Lançamentos primeiro no Instagram</p>
            <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noopener" className="font-titulo text-2xl text-marca hover:text-destaque sm:text-3xl">
              @{instagram}
            </a>
            <a
              href={`https://instagram.com/${instagram}`}
              target="_blank"
              rel="noopener"
              className="mt-2 bg-marca px-8 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-white hover:bg-black"
            >
              Seguir no Instagram
            </a>
          </div>
        </section>
      )}
    </>
  );
}
