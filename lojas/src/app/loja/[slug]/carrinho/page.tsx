import { baseDaLoja } from "@/lib/lojas";
import { CarrinhoPagina } from "@/components/loja/CarrinhoPagina";

export const metadata = { title: "Carrinho" };

export default async function Carrinho({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-8 font-titulo text-4xl text-marca">Carrinho</h1>
      <CarrinhoPagina slug={slug} base={await baseDaLoja(slug)} />
    </div>
  );
}
