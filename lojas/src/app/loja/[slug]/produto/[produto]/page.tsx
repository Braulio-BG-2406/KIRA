import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { baseDaLoja, buscarLoja } from "@/lib/lojas";
import { categoriasDaLoja, listarVitrine, produtoPorSlug } from "@/lib/catalogo";
import { ProdutoRelojoaria } from "@/components/loja/ProdutoRelojoaria";
import { linkWhatsapp } from "@/lib/texto";
import { absoluta, urlDaLoja } from "@/lib/dominios";
import { Comprar } from "@/components/loja/Comprar";
import { Galeria } from "@/components/loja/Galeria";

type Props = { params: Promise<{ slug: string; produto: string }> };

async function carregar({ params }: Props) {
  const { slug, produto } = await params;
  const loja = await buscarLoja(slug);
  if (!loja) notFound();
  const p = await produtoPorSlug(loja.id, produto);
  if (!p) notFound();
  return { loja, p, slug };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { p } = await carregar(props);
  return {
    title: p.nome,
    description: p.descricao.slice(0, 160),
    openGraph: { title: p.nome, description: p.descricao.slice(0, 160), images: p.imagens[0] ? [absoluta(p.imagens[0])] : undefined },
  };
}

export default async function PaginaProduto(props: Props) {
  const { loja, p, slug } = await carregar(props);
  const [base, cats] = await Promise.all([baseDaLoja(slug), categoriasDaLoja(loja.id)]);
  const cat = cats.find((c) => c.id === p.categoriaId);
  // dados estruturados: o Google mostra preço e estoque no resultado da busca
  const url = `${urlDaLoja(slug)}/produto/${p.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.nome,
    description: p.descricao || undefined,
    image: p.imagens.map((i) => absoluta(i)),
    brand: p.marca ? { "@type": "Brand", name: p.marca } : undefined,
    sku: p.variantes[0]?.sku ?? undefined,
    gtin: p.variantes[0]?.codigoBarras ?? undefined,
    offers: p.variantes.map((v) => ({
      "@type": "Offer",
      url,
      priceCurrency: "BRL",
      price: (v.precoCentavos / 100).toFixed(2),
      availability: v.estoque > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      sku: v.sku ?? undefined,
    })),
  };
  const dadosEstruturados = (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
  );
  if (loja.tema === "relojoaria") {
    const parecidos = (await listarVitrine({ lojaId: loja.id, categoriaId: p.categoriaId ?? undefined, limite: 12 })).filter((x) => x.id !== p.id).slice(0, 8);
    return (
      <>
        {dadosEstruturados}
        <ProdutoRelojoaria loja={loja} p={p} base={base} categoria={cat} parecidos={parecidos} />
      </>
    );
  }
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {dadosEstruturados}
      <nav className="mb-6 text-xs text-stone-500">
        <Link href={base || "/"} className="hover:underline">Início</Link>
        {cat && (
          <>
            {" / "}
            <Link href={`${base}/categoria/${cat.slug}`} className="hover:underline">{cat.nome}</Link>
          </>
        )}
      </nav>
      <div className="grid gap-10 md:grid-cols-2">
        <Galeria imagens={p.imagens} nome={p.nome} />
        <div>
          {p.marca && <p className="mb-1 text-xs uppercase tracking-widest text-stone-500">{p.marca}</p>}
          <h1 className="font-titulo text-4xl leading-tight text-marca">{p.nome}</h1>
          <div className="mt-6">
            <Comprar
              slug={slug}
              base={base}
              descontoPixPct={loja.descontoPixPct}
              parcelasSemJuros={loja.parcelasSemJuros}
              variantes={p.variantes.map((v) => ({ id: v.id, nome: v.nome, precoCentavos: v.precoCentavos, precoDeCentavos: v.precoDeCentavos, estoque: v.estoque }))}
            />
          </div>
          {p.descricao && <p className="mt-8 whitespace-pre-line leading-relaxed text-stone-700">{p.descricao}</p>}
          {p.especificacoes.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-700">Ficha técnica</h2>
              <dl className="divide-y divide-stone-200 border-y border-stone-200 text-sm">
                {p.especificacoes.map((e) => (
                  <div key={e.nome} className="grid grid-cols-[140px_1fr] gap-3 py-2">
                    <dt className="text-stone-500">{e.nome}</dt>
                    <dd className="text-stone-800">{e.valor}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {(p.garantia || p.itensInclusos) && (
            <dl className="mt-6 space-y-2 text-sm">
              {p.garantia && (
                <div>
                  <dt className="inline font-medium">Garantia: </dt>
                  <dd className="inline text-stone-700">{p.garantia}</dd>
                </div>
              )}
              {p.itensInclusos && (
                <div>
                  <dt className="inline font-medium">Vem com: </dt>
                  <dd className="inline text-stone-700">{p.itensInclusos}</dd>
                </div>
              )}
            </dl>
          )}
          {loja.whatsapp && (
            <a
              href={linkWhatsapp(loja.whatsapp, `Olá! Tenho uma dúvida sobre ${p.nome}.`)}
              target="_blank"
              rel="noopener"
              className="mt-6 inline-block text-sm text-stone-600 underline"
            >
              Dúvidas? Fale com a gente no WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
