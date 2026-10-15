import Link from "next/link";
import type { Categoria } from "./tipos";
import { IconeCarrinho } from "./IconeCarrinho";
import { MenuRelojoaria } from "./MenuRelojoaria";

/** cabeçalho de relojoaria: branco, fino, nome centralizado e menu em tela cheia */
export function CabecalhoRelojoaria({
  slug,
  base,
  nome,
  logoUrl,
  avisos,
  categorias,
  whatsapp,
}: {
  slug: string;
  base: string;
  nome: string;
  logoUrl: string | null;
  avisos: string[];
  categorias: Categoria[];
  whatsapp: string | null;
}) {
  return (
    <>
      {avisos.length > 0 && (
        <div className="bg-areia px-4 py-2.5 text-center text-[11px] tracking-[0.14em] text-stone-600">
          <span className="sm:hidden">{avisos[0]}</span>
          <span className="hidden sm:inline">{avisos.join("     ·     ")}</span>
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-white/90 text-stone-900 backdrop-blur-md">
        <div className="mx-auto grid h-[72px] max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 sm:px-10">
          <div className="flex items-center gap-8">
            <MenuRelojoaria base={base} categorias={categorias} nome={nome} whatsapp={whatsapp} />
            <Link href={`${base}/busca`} className="hidden items-center gap-2.5 text-[13px] tracking-[0.06em] text-stone-700 hover:text-stone-950 sm:flex">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              Buscar
            </Link>
          </div>
          <Link href={base || "/"} className="justify-self-center" aria-label={nome}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={nome} className="h-8 w-auto" />
            ) : (
              <span className="pl-[0.45em] text-[15px] uppercase tracking-[0.45em] sm:text-[17px]">{nome}</span>
            )}
          </Link>
          <div className="flex justify-end">
            <IconeCarrinho slug={slug} base={base} />
          </div>
        </div>
      </header>
    </>
  );
}
