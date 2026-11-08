import { notFound, redirect } from "next/navigation";
import { baseDaLoja, buscarLoja } from "@/lib/lojas";
import { categoriasDaLoja, listarVitrine, type Ordem } from "@/lib/catalogo";
import { CatalogoPaginado, palavrasDoTema } from "@/components/loja/CatalogoPaginado";

// temas com catálogo próprio em páginas; nos outros, o catálogo é a página inicial
const COM_CATALOGO = ["joalheria", "relojoaria"];

export const metadata = { title: "Catálogo" };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ ordem?: string; pagina?: string; q?: string }> };

/** todas as peças, em páginas */
export default async function Catalogo({ params, searchParams }: Props) {
  const { slug } = await params;
  const loja = await buscarLoja(slug);
  if (!loja) notFound();
  const { ordem: o, pagina, q } = await searchParams;
  const base = await baseDaLoja(slug);
  // endereço antigo de busca do site da Infinite (/catalogo?q=)
  if (q) redirect(`${base}/busca?q=${encodeURIComponent(q)}`);
  if (!COM_CATALOGO.includes(loja.tema)) redirect(`${base || "/"}#produtos`);
  const { palavra, todas } = palavrasDoTema(loja.tema);
  const ordem = ["novidades", "menor", "maior"].includes(o ?? "") ? (o as Ordem) : undefined;
  const [cats, produtos] = await Promise.all([categoriasDaLoja(loja.id), listarVitrine({ lojaId: loja.id, ordem, limite: 5000 })]);
  return (
    <CatalogoPaginado
      loja={loja}
      base={base}
      titulo={todas}
      palavra={palavra}
      sobrelinha="Catálogo"
      categorias={cats}
      produtos={produtos}
      pagina={Number(pagina) || 1}
      ordem={ordem}
      caminho="/catalogo"
    />
  );
}
