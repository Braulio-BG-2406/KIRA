import { notFound } from "next/navigation";
import { baseDaLoja, buscarLoja } from "@/lib/lojas";
import { listarVitrine } from "@/lib/catalogo";
import { GradeProdutos } from "@/components/loja/CartaoProduto";

export const metadata = { title: "Busca" };

export default async function Busca({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string }> }) {
  const { slug } = await params;
  const q = ((await searchParams).q ?? "").slice(0, 100);
  const loja = await buscarLoja(slug);
  if (!loja) notFound();
  const [base, produtos] = await Promise.all([baseDaLoja(slug), q ? listarVitrine({ lojaId: loja.id, busca: q }) : Promise.resolve([])]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-4 font-titulo text-3xl text-marca">Busca</h1>
      <form className="mb-4 flex max-w-lg gap-2">
        <input name="q" defaultValue={q} placeholder="O que você procura?" className="campo" aria-label="Buscar produtos" autoFocus={!q} />
        <button className="botao-primario">Buscar</button>
      </form>
      {q && <p className="mb-8 text-sm text-stone-500">{produtos.length} resultado(s) para &quot;{q}&quot;</p>}
      {q && <GradeProdutos produtos={produtos} base={base} condicoes={loja} variante={loja.tema === "relojoaria" ? "relojoaria" : "padrao"} />}
    </div>
  );
}
