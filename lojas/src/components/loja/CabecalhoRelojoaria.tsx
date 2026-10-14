import Link from "next/link";
import type { Categoria } from "./tipos";
import { IconeCarrinho } from "./IconeCarrinho";

function Lupa() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/** cabeçalho de relojoaria: avisos no topo, nome centralizado e coleções embaixo */
export function CabecalhoRelojoaria({
  slug,
  base,
  nome,
  logoUrl,
  avisos,
  categorias,
}: {
  slug: string;
  base: string;
  nome: string;
  logoUrl: string | null;
  avisos: string[];
  categorias: Categoria[];
}) {
  return (
    <>
      {avisos.length > 0 && (
        <div className="bg-black px-4 py-2 text-center text-[11px] uppercase tracking-[0.22em] text-white/75">
          <span className="sm:hidden">{avisos[0]}</span>
          <span className="hidden sm:inline">{avisos.join("   ·   ")}</span>
        </div>
      )}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-marca/95 text-white backdrop-blur">
        <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4">
          <form action={`${base}/busca`} className="flex items-center">
            <Link href={`${base}/busca`} className="p-2 text-white/80 hover:text-destaque sm:hidden" aria-label="Buscar">
              <Lupa />
            </Link>
            <label className="hidden items-center gap-2 border-b border-white/25 pb-1 text-white/70 focus-within:border-destaque sm:flex">
              <Lupa />
              <input name="q" placeholder="Buscar" className="w-40 bg-transparent text-sm text-white placeholder:text-white/45 focus:outline-none lg:w-56" aria-label="Buscar produtos" />
            </label>
          </form>
          <Link href={base || "/"} className="justify-self-center">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={nome} className="h-9 w-auto" />
            ) : (
              <span className="text-lg font-semibold uppercase tracking-[0.38em] sm:text-xl">{nome}</span>
            )}
          </Link>
          <div className="flex justify-end">
            <IconeCarrinho slug={slug} base={base} />
          </div>
        </div>
        {categorias.length > 0 && (
          <nav className="flex gap-7 overflow-x-auto border-t border-white/10 px-4 py-3 text-[12px] uppercase tracking-[0.18em] text-white/70 sm:justify-center">
            {categorias.map((c) => (
              <Link key={c.id} href={`${base}/categoria/${c.slug}`} className="whitespace-nowrap border-b border-transparent pb-0.5 hover:border-destaque hover:text-white">
                {c.nome}
              </Link>
            ))}
          </nav>
        )}
      </header>
    </>
  );
}
