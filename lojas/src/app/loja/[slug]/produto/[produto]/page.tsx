import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { baseDaLoja, buscarLoja } from "@/lib/lojas";
import { categoriasDaLoja, produtoPorSlug } from "@/lib/catalogo";
import { linkWhatsapp } from "@/lib/texto";
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
  return { title: p.nome, description: p.descricao.slice(0, 160), openGraph: p.imagens[0] ? { images: [p.imagens[0]] } : undefined };
}

export default async function PaginaProduto(props: Props) {
  const { loja, p, slug } = await carregar(props);
  const [base, cats] = await Promise.all([baseDaLoja(slug), categoriasDaLoja(loja.id)]);
  const cat = cats.find((c) => c.id === p.categoriaId);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
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
          <h1 className="font-titulo text-4xl leading-tight text-marca">{p.nome}</h1>
          <div className="mt-6">
            <Comprar
              slug={slug}
              base={base}
              variantes={p.variantes.map((v) => ({ id: v.id, nome: v.nome, precoCentavos: v.precoCentavos, precoDeCentavos: v.precoDeCentavos, estoque: v.estoque }))}
            />
          </div>
          {p.descricao && <p className="mt-8 whitespace-pre-line leading-relaxed text-stone-700">{p.descricao}</p>}
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
