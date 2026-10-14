import { redirect } from "next/navigation";
import { baseDaLoja } from "@/lib/lojas";

export const metadata = { title: "Acompanhar pedido" };

export default async function BuscarPedido({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ codigo?: string }> }) {
  const { slug } = await params;
  const codigo = (await searchParams).codigo?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const base = await baseDaLoja(slug);
  if (codigo) redirect(`${base}/pedido/${codigo}`);
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-titulo text-3xl text-marca">Acompanhar pedido</h1>
      <p className="mt-2 text-sm text-stone-600">Digite o código que aparece na confirmação do pedido.</p>
      <form className="mt-6 flex gap-2">
        <input name="codigo" className="campo" placeholder="Código do pedido" required aria-label="Código do pedido" />
        <button className="botao-primario">Ver</button>
      </form>
    </div>
  );
}
