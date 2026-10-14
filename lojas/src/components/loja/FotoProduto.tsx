/* eslint-disable @next/next/no-img-element */
export function FotoProduto({ url, nome, className = "" }: { url?: string | null; nome: string; className?: string }) {
  if (url) {
    return <img src={url} alt={nome} loading="lazy" className={`h-full w-full object-cover ${className}`} />;
  }
  // sem foto: um quadro com a inicial, nas cores da loja
  return (
    <div
      aria-label={nome}
      role="img"
      className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-destaque/15 via-stone-50 to-marca/10 ${className}`}
    >
      <span className="font-titulo text-5xl text-destaque/70 select-none">{nome.trim().charAt(0).toUpperCase()}</span>
    </div>
  );
}
