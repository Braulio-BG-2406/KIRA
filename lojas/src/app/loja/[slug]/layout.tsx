import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { baseDaLoja, buscarLoja } from "@/lib/lojas";
import { categoriasDaLoja } from "@/lib/catalogo";
import { corValida, linkWhatsapp } from "@/lib/texto";
import { IconeCarrinho } from "@/components/loja/IconeCarrinho";
import { Rastreamento } from "@/components/loja/Rastreamento";
import { rastreamentoSeguro } from "@/lib/rastreamento";

type Props = { children: React.ReactNode; params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const loja = await buscarLoja((await params).slug);
  if (!loja) return {};
  const r = rastreamentoSeguro(loja.rastreamento);
  return {
    title: { default: loja.slogan ? `${loja.nome} | ${loja.slogan}` : loja.nome, template: `%s | ${loja.nome}` },
    description: loja.sobre ?? loja.slogan ?? undefined,
    openGraph: { siteName: loja.nome, locale: "pt_BR", type: "website" },
    verification: {
      google: r.googleVerificacao,
      other: r.metaVerificacao ? { "facebook-domain-verification": r.metaVerificacao } : undefined,
    },
  };
}

export default async function LayoutLoja({ children, params }: Props) {
  const { slug } = await params;
  const loja = await buscarLoja(slug);
  if (!loja) notFound();
  const [base, cats] = await Promise.all([baseDaLoja(slug), categoriasDaLoja(loja.id)]);
  const estilo = {
    "--cor-primaria": corValida(loja.corPrimaria, "#1f2937"),
    "--cor-destaque": corValida(loja.corDestaque, "#b08d57"),
  } as React.CSSProperties;
  const instagram = loja.instagram?.replace(/^@/, "");
  const moderno = loja.tema === "moderno";

  return (
    <div style={estilo} data-tema={loja.tema} className="flex min-h-screen flex-col">
      <Rastreamento r={rastreamentoSeguro(loja.rastreamento)} />
      <header className={`sticky top-0 z-20 border-b backdrop-blur ${moderno ? "border-white/10 bg-marca text-white" : "border-stone-200 bg-white/95"}`}>
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link href={base || "/"} className="shrink-0">
            {loja.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={loja.logoUrl} alt={loja.nome} className="h-10 w-auto" />
            ) : (
              <span className={`font-titulo text-2xl tracking-wide ${moderno ? "text-white" : "text-marca"}`}>{loja.nome}</span>
            )}
          </Link>
          <form action={`${base}/busca`} className="ml-auto hidden max-w-xs flex-1 sm:block">
            <input name="q" placeholder="Buscar produtos" className="campo text-stone-900" aria-label="Buscar produtos" />
          </form>
          <div className="ml-auto sm:ml-0">
            <IconeCarrinho slug={slug} base={base} />
          </div>
        </div>
        {cats.length > 0 && (
          <nav className={`mx-auto flex max-w-6xl gap-5 overflow-x-auto px-4 pb-3 text-sm ${moderno ? "text-white/70" : "text-stone-600"}`}>
            {cats.map((c) => (
              <Link key={c.id} href={`${base}/categoria/${c.slug}`} className={`whitespace-nowrap ${moderno ? "hover:text-destaque" : "hover:text-marca"}`}>
                {c.nome}
              </Link>
            ))}
          </nav>
        )}
        <form action={`${base}/busca`} className="px-4 pb-3 sm:hidden">
          <input name="q" placeholder="Buscar produtos" className="campo text-stone-900" aria-label="Buscar produtos" />
        </form>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-16 bg-marca text-white/80">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-3">
          <div>
            <p className="font-titulo text-xl text-white">{loja.nome}</p>
            {loja.sobre && <p className="mt-2 leading-relaxed">{loja.sobre}</p>}
          </div>
          <div className="space-y-2">
            <p className="font-medium text-white">Atendimento</p>
            {loja.whatsapp && (
              <a className="block hover:text-white" href={linkWhatsapp(loja.whatsapp)} target="_blank" rel="noopener">
                WhatsApp
              </a>
            )}
            {instagram && (
              <a className="block hover:text-white" href={`https://instagram.com/${instagram}`} target="_blank" rel="noopener">
                Instagram @{instagram}
              </a>
            )}
            {loja.email && <a className="block hover:text-white" href={`mailto:${loja.email}`}>{loja.email}</a>}
          </div>
          <div className="space-y-2">
            <p className="font-medium text-white">Seu pedido</p>
            <Link className="block hover:text-white" href={`${base}/pedido`}>
              Acompanhar pedido
            </Link>
          </div>
        </div>
        <p className="border-t border-white/10 py-4 text-center text-xs text-white/50">
          © {new Date().getFullYear()} {loja.nome}
        </p>
      </footer>

      {loja.whatsapp && (
        <a
          href={linkWhatsapp(loja.whatsapp, `Olá! Vim pelo site da ${loja.nome}.`)}
          target="_blank"
          rel="noopener"
          aria-label="Falar no WhatsApp"
          className="fixed bottom-4 right-4 z-30 flex h-13 w-13 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg hover:brightness-95"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z" />
          </svg>
        </a>
      )}
    </div>
  );
}
