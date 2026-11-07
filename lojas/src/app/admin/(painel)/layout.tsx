import Link from "next/link";
import { contexto } from "@/lib/painel";
import { todasAsLojas } from "@/lib/lojas";
import { urlDaLoja } from "@/lib/dominios";
import { acaoSair, acaoTrocarLoja } from "../acoes";
import { Abas, BarraCelular, MenuLateral } from "./Menu";
import { SeletorLoja } from "./SeletorLoja";

export const metadata = { title: "Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const { usuario, loja } = await contexto();
  const lojas = await todasAsLojas();
  const sair = (
    <form action={acaoSair} className="flex items-center justify-between text-xs text-stone-500">
      <span className="truncate">{usuario.email}</span>
      <button className="underline">Sair</button>
    </form>
  );
  return (
    <div className="min-h-screen bg-stone-100 pb-20 lg:flex lg:pb-0">
      <aside className="border-b border-stone-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-56 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r print:hidden">
        <div className="flex items-center gap-3 px-4 py-3 lg:block lg:py-5">
          <form action={acaoTrocarLoja} className="flex-1">
            <label className="sr-only" htmlFor="loja">Loja</label>
            <SeletorLoja lojas={lojas.map((l) => ({ slug: l.slug, nome: l.nome }))} atual={loja.slug} />
            <noscript>
              <button className="botao-secundario mt-2 w-full">Trocar</button>
            </noscript>
          </form>
          <Link href={urlDaLoja(loja.slug)} target="_blank" className="whitespace-nowrap text-xs text-stone-500 underline lg:mt-2 lg:inline-block">
            Ver site
          </Link>
        </div>
        <MenuLateral />
        <div className="mt-auto hidden px-6 py-4 lg:block">{sair}</div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <div className="mx-auto max-w-6xl">
          <Abas />
          {children}
        </div>
      </main>
      <BarraCelular extra={sair} />
    </div>
  );
}
