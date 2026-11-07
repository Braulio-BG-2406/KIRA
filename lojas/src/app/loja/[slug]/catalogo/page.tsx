import { notFound, redirect } from "next/navigation";
import { baseDaLoja, buscarLoja } from "@/lib/lojas";
import { categoriasDaLoja, listarVitrine, type Ordem } from "@/lib/catalogo";
import { CatalogoJoalheria } from "@/components/loja/CatalogoJoalheria";

export const metadata = { title: "Catálogo" };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ ordem?: string; pagina?: string; q?: string }> };

/** todas as peças, em páginas (no tema joalheria); nos outros temas o catálogo é a página inicial */
export default async function Catalogo({ params, searchParams }: Props) {
  const { slug } = await params;
  const loja = await buscarLoja(slug);
  if (!loja) notFound();
  const { ordem: o, pagina, q } = await searchParams;
  const base = await baseDaLoja(slug);
  // endereço antigo de busca do site da Infinite (/catalogo?q=)
  if (q) redirect(`${base}/busca?q=${encodeURIComponent(q)}`);
  if (loja.tema !== "joalheria") redirect(`${base || "/"}#produtos`);
  const ordem = ["novidades", "menor", "maior"].includes(o ?? "") ? (o as Ordem) : undefined;
  const [cats, produtos] = await Promise.all([categoriasDaLoja(loja.id), listarVitrine({ lojaId: loja.id, ordem, limite: 5000 })]);
  return (
    <CatalogoJoalheria
      loja={loja}
      base={base}
      titulo="Todas as peças"
      sobrelinha="Catálogo"
      categorias={cats}
      produtos={produtos}
      pagina={Number(pagina) || 1}
      ordem={ordem}
      caminho="/catalogo"
    />
  );
}
