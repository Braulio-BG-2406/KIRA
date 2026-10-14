import Link from "next/link";
import { notFound } from "next/navigation";
import { baseDaLoja, buscarLoja } from "@/lib/lojas";
import { categoriasDaLoja, listarVitrine } from "@/lib/catalogo";
import { GradeProdutos } from "@/components/loja/CartaoProduto";

export default async function VitrineInicio({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loja = await buscarLoja(slug);
  if (!loja) notFound();
  const [base, cats, destaques, todos] = await Promise.all([
    baseDaLoja(slug),
    categoriasDaLoja(loja.id),
    listarVitrine({ lojaId: loja.id, destaque: true, limite: 8 }),
    listarVitrine({ lojaId: loja.id, limite: 24 }),
  ]);
  const gratis = loja.frete.entrega.ativo ? loja.frete.entrega.gratisAcimaCentavos : null;

  return (
    <>
      <section className="bg-marca text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <p className="text-xs uppercase tracking-[0.3em] text-destaque">{loja.nome}</p>
          <h1 className="mt-3 max-w-2xl font-titulo text-4xl leading-tight sm:text-5xl">{loja.slogan ?? loja.nome}</h1>
          {loja.sobre && <p className="mt-4 max-w-xl text-white/75">{loja.sobre}</p>}
          <a href="#produtos" className="mt-8 inline-block rounded-md bg-destaque px-6 py-3 text-sm font-medium text-white hover:brightness-110">
            Ver produtos
          </a>
        </div>
      </section>

      {gratis != null && (
        <p className="border-b border-stone-200 bg-stone-50 py-2 text-center text-xs text-stone-600">
          Frete grátis nas compras a partir de {(gratis / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </p>
      )}

      <div className="mx-auto max-w-6xl px-4">
        {cats.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2">
            {cats.map((c) => (
              <Link key={c.id} href={`${base}/categoria/${c.slug}`} className="rounded-full border border-stone-300 px-4 py-1.5 text-sm hover:border-marca hover:text-marca">
                {c.nome}
              </Link>
            ))}
          </div>
        )}

        {destaques.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-6 font-titulo text-3xl text-marca">Destaques</h2>
            <GradeProdutos produtos={destaques} base={base} />
          </section>
        )}

        <section id="produtos" className="mt-16 scroll-mt-28">
          <h2 className="mb-6 font-titulo text-3xl text-marca">Todos os produtos</h2>
          <GradeProdutos produtos={todos} base={base} />
        </section>
      </div>
    </>
  );
}
