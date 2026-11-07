import Link from "next/link";
import type { Categoria } from "./tipos";
import { IconeCarrinho } from "./IconeCarrinho";
import { MenuJoalheria } from "./MenuJoalheria";

type Props = {
  slug: string;
  base: string;
  nome: string;
  logo: string | null;
  categorias: Categoria[];
  menu: { nome: string; href: string }[];
  paginas: { nome: string; href: string }[];
  whatsapp: string | null;
  instagram: string | null;
};

const lupa = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

/** cabeçalho escuro: logo à esquerda, menu no meio, busca e sacola à direita */
export function CabecalhoJoalheria({ slug, base, nome, logo, categorias, menu, paginas, whatsapp, instagram }: Props) {
  const link = "text-[14px] text-[#f3efe6]/90 transition hover:text-[#c5a978]";
  return (
    <header className="sticky top-0 z-30 border-b border-[#f3efe6]/8 bg-[#0b0b0c]/92 text-[#f3efe6] backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-[1440px] items-center gap-6 px-5 sm:px-10">
        <Link href={base || "/"} aria-label={nome} className="shrink-0">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={nome} className="h-[26px] w-auto sm:h-[30px]" />
          ) : (
            <span className="font-titulo text-2xl tracking-[0.12em]">{nome}</span>
          )}
        </Link>
        <nav className="mx-auto hidden items-center gap-8 lg:flex" aria-label="Principal">
          {menu.slice(0, 1).map((m) => (
            <Link key={m.href} href={`${base}${m.href}`} className={link}>
              {m.nome}
            </Link>
          ))}
          <Link href={`${base}/catalogo`} className={link}>
            Coleções
          </Link>
          {menu.slice(1).map((m) => (
            <Link key={m.href} href={`${base}${m.href}`} className={link}>
              {m.nome}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-5 lg:ml-0">
          <Link href={`${base}/busca`} className={`${link} flex items-center gap-2 px-1.5 py-1`} aria-label="Buscar">
            {lupa}
            <span className="hidden sm:inline">Buscar</span>
          </Link>
          <IconeCarrinho slug={slug} base={base} />
          <MenuJoalheria base={base} nome={nome} logo={logo} categorias={categorias} menu={menu} paginas={paginas} whatsapp={whatsapp} instagram={instagram} />
        </div>
      </div>
    </header>
  );
}
