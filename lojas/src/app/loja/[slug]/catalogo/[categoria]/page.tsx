import { permanentRedirect } from "next/navigation";
import { baseDaLoja } from "@/lib/lojas";

/** endereço antigo do site da Infinite (/catalogo/brincos) leva à coleção (/categoria/brincos) */
export default async function CatalogoAntigo({ params }: { params: Promise<{ slug: string; categoria: string }> }) {
  const { slug, categoria } = await params;
  permanentRedirect(`${await baseDaLoja(slug)}/categoria/${encodeURIComponent(categoria)}`);
}
