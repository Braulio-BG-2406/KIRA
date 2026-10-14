"use client";

import Link from "next/link";
import { useCarrinho } from "./carrinho";

export function IconeCarrinho({ slug, base }: { slug: string; base: string }) {
  const itens = useCarrinho(slug);
  const total = itens.reduce((s, i) => s + i.quantidade, 0);
  return (
    <Link href={`${base}/carrinho`} className="relative inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm hover:bg-black/10" aria-label="Carrinho">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M6 7h12l-1 13H7L6 7Z" />
        <path d="M9 7a3 3 0 0 1 6 0" />
      </svg>
      {total > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destaque px-1 text-[11px] font-semibold text-white">
          {total}
        </span>
      )}
    </Link>
  );
}
