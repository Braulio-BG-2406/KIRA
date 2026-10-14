import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { baseDaLoja, buscarLoja } from "@/lib/lojas";
import { categoriasDaLoja, listarVitrine, marcasDaLoja, type Ordem } from "@/lib/catalogo";
import { Ordenar } from "@/components/loja/Ordenar";
import { GradeProdutos } from "@/components/loja/CartaoProduto";

type Props = { params: Promise<{ slug: string; categoria: string }>; searchParams: Promise<{ marca?: string; ordem?: string }> };

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
  const { marca, ordem: o } = await searchParams;
  const ordem = ["novidades", "menor", "maior"].includes(o ?? "") ? (o as Ordem) : undefined;
  const relojoaria = loja.tema === "relojoaria";
  const [base, produtos, marcas] = await Promise.all([
    baseDaLoja(slug),
    listarVitrine({ lojaId: loja.id, categoriaId: cat.id, marca, ordem }),
    marcasDaLoja(loja.id, cat.id),
  ]);
  const aqui = `${base}/categoria/${cat.slug}`;
  return (
    <div id="produtos" className={`mx-auto px-4 py-10 ${relojoaria ? "max-w-7xl" : "max-w-6xl"}`}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className={`font-titulo text-marca ${relojoaria ? "text-3xl" : "text-4xl"}`}>{cat.nome}</h1>
        <Ordenar atual={ordem} />
      </div>
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
      <GradeProdutos produtos={produtos} base={base} condicoes={loja} variante={relojoaria ? "relojoaria" : "padrao"} />
    </div>
  );
}
