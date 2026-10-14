import Link from "next/link";
import { contexto } from "@/lib/painel";
import { todasAsLojas } from "@/lib/lojas";
import { acaoSair, acaoTrocarLoja } from "../acoes";
import { Menu } from "./Menu";
import { SeletorLoja } from "./SeletorLoja";

export const metadata = { title: "Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const { usuario, loja } = await contexto();
  const lojas = await todasAsLojas();
  return (
    <div className="min-h-screen bg-stone-100 lg:flex">
      <aside className="border-b border-stone-200 bg-white lg:sticky lg:top-0 lg:h-screen lg:w-56 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 px-4 py-3 lg:block lg:py-5">
          <form action={acaoTrocarLoja} className="flex-1">
            <label className="sr-only" htmlFor="loja">Loja</label>
            <SeletorLoja lojas={lojas.map((l) => ({ slug: l.slug, nome: l.nome }))} atual={loja.slug} />
            <noscript>
              <button className="botao-secundario mt-2 w-full">Trocar</button>
            </noscript>
          </form>
          <Link href={`/loja/${loja.slug}`} target="_blank" className="text-xs text-stone-500 underline lg:mt-2 lg:inline-block">
            Ver site
          </Link>
        </div>
        <Menu />
        <div className="hidden px-6 py-4 text-xs text-stone-500 lg:absolute lg:bottom-0 lg:block">
          <p className="truncate">{usuario.email}</p>
          <form action={acaoSair}>
            <button className="mt-1 underline">Sair</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">{children}</div>
        <form action={acaoSair} className="mt-10 text-center text-xs text-stone-500 lg:hidden">
          {usuario.email} · <button className="underline">Sair</button>
        </form>
      </main>
    </div>
  );
}
