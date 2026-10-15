"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Categoria } from "./tipos";

/** menu em tela cheia, com as coleções em letra grande */
export function MenuRelojoaria({ base, categorias, nome, whatsapp }: { base: string; categorias: Categoria[]; nome: string; whatsapp: string | null }) {
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

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className="flex items-center gap-3 text-[13px] tracking-[0.06em]" aria-expanded={aberto}>
        <span className="flex w-5 flex-col gap-[5px]" aria-hidden>
          <span className="h-px bg-current" />
          <span className="h-px bg-current" />
        </span>
        <span className="hidden sm:inline">Menu</span>
      </button>
      {/* vai direto para o body: o desfoque do cabeçalho prenderia o menu dentro dele */}
      {aberto &&
        createPortal(
        <div data-tema="relojoaria" className="fixed inset-0 z-50 overflow-y-auto bg-white text-stone-900" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:px-10">
            <button type="button" onClick={() => setAberto(false)} className="flex items-center gap-3 text-[13px] tracking-[0.06em]">
              <span className="relative h-4 w-5" aria-hidden>
                <span className="absolute top-1/2 h-px w-5 rotate-45 bg-current" />
                <span className="absolute top-1/2 h-px w-5 -rotate-45 bg-current" />
              </span>
              Fechar
            </button>
            <span className="text-[15px] uppercase tracking-[0.45em]">{nome}</span>
            <span className="w-16" />
          </div>
          <nav className="mx-auto grid max-w-[1440px] gap-12 px-5 pb-16 pt-10 sm:px-10 md:grid-cols-[2fr_1fr] md:pt-16">
            <div>
              <p className="sobrelinha mb-6 text-stone-500">Coleções</p>
              <ul className="space-y-3">
                {categorias.map((c) => (
                  <li key={c.id}>
                    <Link href={`${base}/categoria/${c.slug}`} onClick={() => setAberto(false)} className="font-titulo text-4xl text-stone-900 transition hover:text-destaque sm:text-5xl">
                      {c.nome}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4 text-[15px] text-stone-700 md:border-l md:border-stone-200 md:pl-12">
              <p className="sobrelinha mb-6 text-stone-500">Sua compra</p>
              <Link href={base ? `${base}#produtos` : "/#produtos"} onClick={() => setAberto(false)} className="block hover:text-stone-950">Todos os modelos</Link>
              <Link href={`${base}/busca`} onClick={() => setAberto(false)} className="block hover:text-stone-950">Buscar</Link>
              <Link href={`${base}/carrinho`} onClick={() => setAberto(false)} className="block hover:text-stone-950">Sacola</Link>
              <Link href={`${base}/pedido`} onClick={() => setAberto(false)} className="block hover:text-stone-950">Acompanhar pedido</Link>
              {whatsapp && (
                <a href={whatsapp} target="_blank" rel="noopener" className="block hover:text-stone-950">
                  Atendimento no WhatsApp
                </a>
              )}
            </div>
          </nav>
        </div>,
          document.body,
        )}
    </>
  );
}
