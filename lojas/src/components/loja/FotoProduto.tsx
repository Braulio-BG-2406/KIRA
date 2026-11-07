/* eslint-disable @next/next/no-img-element */
import { DesenhoRelogio } from "./DesenhoRelogio";

export function FotoProduto({ url, nome, className = "", escuro = false }: { url?: string | null; nome: string; className?: string; escuro?: boolean }) {
  if (url) {
    return <img src={url} alt={nome} loading="lazy" className={`h-full w-full object-cover ${className}`} />;
  }
  // sem foto: a inicial nas cores da loja (ou um relógio desenhado, no tema relojoaria)
  return (
    <div
      aria-label={nome}
      role="img"
      className={`flex h-full w-full items-center justify-center ${escuro ? "bg-[radial-gradient(circle_at_50%_45%,#2a2a2e,#0f0f10_70%)]" : "vazio-fundo bg-gradient-to-br from-destaque/15 via-stone-50 to-marca/10"} ${className}`}
    >
      <span className="vazio-letra font-titulo text-5xl text-destaque/70 select-none">{nome.trim().charAt(0).toUpperCase()}</span>
      <DesenhoRelogio className="vazio-relogio h-3/5 w-auto text-destaque/70" />
    </div>
  );
}
