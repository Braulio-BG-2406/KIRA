"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Categoria } from "./tipos";

type Props = {
  base: string;
  nome: string;
  logo: string | null;
  categorias: Categoria[];
  menu: { nome: string; href: string }[];
  paginas: { nome: string; href: string }[];
  whatsapp: string | null;
  instagram: string | null;
};

/** menu em tela cheia (no celular é o único menu; no computador mostra todas as coleções e páginas) */
export function MenuJoalheria({ base, nome, logo, categorias, menu, paginas, whatsapp, instagram }: Props) {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    document.body.style.overflow = aberto ? "hidden" : "";
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", fechar);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", fechar);
    };
  }, [aberto]);

  const fechar = () => setAberto(false);
  const pequeno = "block py-1.5 text-[15px] text-[#c2bdb4] transition hover:text-[#f3efe6]";

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-[#f3efe6] transition hover:bg-[#f3efe6]/8"
        aria-expanded={aberto}
        aria-label="Abrir menu"
      >
        <span className="flex w-5 flex-col gap-[6px]" aria-hidden>
          <span className="h-px bg-current" />
          <span className="h-px bg-current" />
        </span>
      </button>
      {aberto &&
        createPortal(
          <div data-tema="joalheria" className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-5 sm:px-10">
              <Link href={base || "/"} onClick={fechar} aria-label={nome}>
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt={nome} className="h-[26px] w-auto sm:h-[30px]" />
                ) : (
                  <span className="font-titulo text-2xl tracking-[0.12em]">{nome}</span>
                )}
              </Link>
              <button type="button" onClick={fechar} className="flex h-10 items-center gap-3 text-[14px] text-[#f3efe6]" aria-label="Fechar menu">
                Fechar
                <span className="relative h-4 w-5" aria-hidden>
                  <span className="absolute top-1/2 h-px w-5 rotate-45 bg-current" />
                  <span className="absolute top-1/2 h-px w-5 -rotate-45 bg-current" />
                </span>
              </button>
            </div>
            <nav className="mx-auto grid max-w-[1440px] gap-12 px-5 pb-16 pt-6 sm:px-10 md:grid-cols-[2fr_1fr] md:pt-14">
              <div>
                <form action={`${base}/busca`} className="mb-10 max-w-md">
                  <input name="q" type="search" placeholder="Buscar peças" className="campo py-3" aria-label="Buscar peças" />
                </form>
                <p className="sobrelinha-j mb-5">Coleções</p>
                <ul className="grid gap-x-10 gap-y-2 sm:grid-cols-2">
                  <li>
                    <Link href={`${base}/catalogo`} onClick={fechar} className="font-titulo text-4xl text-[#f3efe6] transition hover:text-[#c5a978]">
                      Todas as peças
                    </Link>
                  </li>
                  {categorias.map((c) => (
                    <li key={c.id}>
                      <Link href={`${base}/categoria/${c.slug}`} onClick={fechar} className="font-titulo text-4xl text-[#f3efe6] transition hover:text-[#c5a978]">
                        {c.nome}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-8 md:border-l md:border-[#30302d] md:pl-12">
                <div>
                  <p className="sobrelinha-j mb-4">Loja</p>
                  {menu.map((m) => (
                    <Link key={m.href} href={`${base}${m.href}`} onClick={fechar} className={pequeno}>
                      {m.nome}
                    </Link>
                  ))}
                  <Link href={`${base}/carrinho`} onClick={fechar} className={pequeno}>
                    Sacola
                  </Link>
                  <Link href={`${base}/pedido`} onClick={fechar} className={pequeno}>
                    Acompanhar pedido
                  </Link>
                </div>
                {paginas.length > 0 && (
                  <div>
                    <p className="sobrelinha-j mb-4">Ajuda</p>
                    {paginas.map((p) => (
                      <Link key={p.href} href={`${base}${p.href}`} onClick={fechar} className={pequeno}>
                        {p.nome}
                      </Link>
                    ))}
                  </div>
                )}
                <div>
                  <p className="sobrelinha-j mb-4">Atendimento</p>
                  {whatsapp && (
                    <a href={whatsapp} target="_blank" rel="noopener" className={pequeno}>
                      WhatsApp
                    </a>
                  )}
                  {instagram && (
                    <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noopener" className={pequeno}>
                      Instagram
                    </a>
                  )}
                </div>
              </div>
            </nav>
          </div>,
          document.body,
        )}
    </>
  );
}
