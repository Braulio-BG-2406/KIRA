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
  const chip = (ativo: boolean) =>
    relojoaria
      ? `whitespace-nowrap rounded-full border px-4 py-1.5 text-[13px] font-light transition ${ativo ? "border-stone-950 bg-stone-950 text-white" : "border-stone-300 text-stone-700 hover:border-stone-950"}`
      : `rounded-full border px-3 py-1 ${ativo ? "border-marca bg-marca text-white" : "border-stone-300"}`;
  const filtros = marcas.length > 1 && (
    <div className="flex flex-wrap gap-2 text-sm">
      <Link href={aqui} className={chip(!marca)}>
        Todas as marcas
      </Link>
      {marcas.map((m) => (
        <Link key={m} href={`${aqui}?marca=${encodeURIComponent(m)}`} className={chip(marca === m)}>
          {m}
        </Link>
      ))}
    </div>
  );

  if (relojoaria) {
    return (
      <>
        <section className="bg-areia px-6 py-16 text-center sm:py-24">
          <p className="sobrelinha text-destaque">Coleção</p>
          <h1 className="mt-5 font-titulo text-5xl text-stone-950 sm:text-6xl">{cat.nome}</h1>
          <p className="mt-4 font-light text-stone-600">
            {produtos.length} {produtos.length === 1 ? "modelo" : "modelos"}
          </p>
        </section>
        <div id="produtos" className="mx-auto max-w-[1440px] px-5 pb-24 sm:px-10">
          <div className="mb-12 flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 py-5">
            {filtros || <span />}
            <Ordenar atual={ordem} />
          </div>
          <GradeProdutos produtos={produtos} base={base} condicoes={loja} variante="relojoaria" />
        </div>
      </>
    );
  }

  return (
    <div id="produtos" className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-titulo text-4xl text-marca">{cat.nome}</h1>
        <Ordenar atual={ordem} />
      </div>
      {filtros && <div className="mb-8">{filtros}</div>}
      <GradeProdutos produtos={produtos} base={base} condicoes={loja} />
    </div>
  );
}
