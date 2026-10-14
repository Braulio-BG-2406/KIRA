import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { baseDaLoja, buscarLoja } from "@/lib/lojas";
import { categoriasDaLoja, listarVitrine } from "@/lib/catalogo";
import { GradeProdutos } from "@/components/loja/CartaoProduto";

type Props = { params: Promise<{ slug: string; categoria: string }> };

async function carregar({ params }: Props) {
  const { slug, categoria } = await params;
  const loja = await buscarLoja(slug);
  if (!loja) notFound();
  const cat = (await categoriasDaLoja(loja.id)).find((c) => c.slug === categoria);
  if (!cat) notFound();
  return { loja, cat, slug };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { cat } = await carregar(props);
  return { title: cat.nome };
}

export default async function Categoria(props: Props) {
  const { loja, cat, slug } = await carregar(props);
  const [base, produtos] = await Promise.all([baseDaLoja(slug), listarVitrine({ lojaId: loja.id, categoriaId: cat.id })]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-8 font-titulo text-4xl text-marca">{cat.nome}</h1>
      <GradeProdutos produtos={produtos} base={base} />
    </div>
  );
}
