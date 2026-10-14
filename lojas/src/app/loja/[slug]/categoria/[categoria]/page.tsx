import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { baseDaLoja, buscarLoja } from "@/lib/lojas";
import { categoriasDaLoja, listarVitrine, marcasDaLoja } from "@/lib/catalogo";
import { GradeProdutos } from "@/components/loja/CartaoProduto";

type Props = { params: Promise<{ slug: string; categoria: string }>; searchParams: Promise<{ marca?: string }> };

async function carregar(params: Props["params"]) {
  const { slug, categoria } = await params;
  const loja = await buscarLoja(slug);
  if (!loja) notFound();
  const cat = (await categoriasDaLoja(loja.id)).find((c) => c.slug === categoria);
  if (!cat) notFound();
  return { loja, cat, slug };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cat } = await carregar(params);
  return { title: cat.nome };
}

export default async function Categoria({ params, searchParams }: Props) {
  const { loja, cat, slug } = await carregar(params);
  const marca = (await searchParams).marca;
  const [base, produtos, marcas] = await Promise.all([
    baseDaLoja(slug),
    listarVitrine({ lojaId: loja.id, categoriaId: cat.id, marca }),
    marcasDaLoja(loja.id, cat.id),
  ]);
  const aqui = `${base}/categoria/${cat.slug}`;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 font-titulo text-4xl text-marca">{cat.nome}</h1>
      {marcas.length > 1 && (
        <div className="mb-8 flex flex-wrap gap-2 text-sm">
          <Link href={aqui} className={`rounded-full border px-3 py-1 ${!marca ? "border-marca bg-marca text-white" : "border-stone-300"}`}>
            Todas
          </Link>
          {marcas.map((m) => (
            <Link key={m} href={`${aqui}?marca=${encodeURIComponent(m)}`} className={`rounded-full border px-3 py-1 ${marca === m ? "border-marca bg-marca text-white" : "border-stone-300"}`}>
              {m}
            </Link>
          ))}
        </div>
      )}
      <GradeProdutos produtos={produtos} base={base} condicoes={loja} />
    </div>
  );
}
