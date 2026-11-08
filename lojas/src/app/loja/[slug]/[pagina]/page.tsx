import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { baseDaLoja, buscarLoja } from "@/lib/lojas";
import { paginasDaLoja, preencher, preencherOuNada } from "@/lib/paginas";
import { linkWhatsapp } from "@/lib/texto";

type Props = { params: Promise<{ slug: string; pagina: string }> };

async function carregar(params: Props["params"]) {
  const { slug, pagina } = await params;
  const loja = await buscarLoja(slug);
  if (!loja) notFound();
  const paginas = paginasDaLoja(slug);
  const p = paginas.find((x) => x.slug === pagina);
  if (!p) notFound();
  return { loja, p, paginas, slug };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if ((await params).pagina === "conta") return {};
  const { p, loja } = await carregar(params);
  return { title: p.titulo, description: p.subtitulo ? preencher(p.subtitulo, loja) : undefined };
}

/** páginas institucionais (quem somos, entregas, trocas, termos, privacidade...) */
export default async function PaginaInstitucional({ params }: Props) {
  const { slug: s, pagina } = await params;
  // "Minha conta" do site antigo: aqui o cliente acompanha o pedido pelo código, sem cadastro
  if (pagina === "conta") redirect(`${await baseDaLoja(s)}/pedido`);
  const { loja, p, paginas, slug } = await carregar(params);
  const base = await baseDaLoja(slug);
  const t = (x: string) => preencher(x, loja);
  const ajuda = paginas.filter((x) => x.grupo === p.grupo);
  // linhas com dado que falta (CNPJ, endereço, WhatsApp...) não aparecem; bloco que ficar vazio também não
  const blocos = p.blocos
    .map((b) => ({
      titulo: b.titulo ? t(b.titulo) : undefined,
      texto: (b.texto ?? []).map((x) => preencherOuNada(x, loja)).filter((x): x is string => !!x),
      lista: (b.lista ?? []).map((x) => preencherOuNada(x, loja)).filter((x): x is string => !!x),
    }))
    .filter((b) => b.texto.length || b.lista.length);
  return (
    <div className="mx-auto max-w-[1100px] px-5 pb-16 pt-10 sm:px-10">
      {ajuda.length > 1 && (
        <nav className="sem-barra -mx-5 mb-10 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:px-0" aria-label="Páginas">
          {ajuda.map((x) => (
            <Link key={x.slug} href={`${base}/${x.slug}`} aria-current={x.slug === p.slug ? "page" : undefined} className="chip-v" data-ativo={x.slug === p.slug}>
              {x.titulo}
            </Link>
          ))}
        </nav>
      )}
      <h1 className="font-titulo text-5xl text-[var(--v-texto)] sm:text-6xl">{p.titulo}</h1>
      {p.subtitulo && <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-[var(--v-suave)]">{t(p.subtitulo)}</p>}
      {p.versao && <p className="mt-2 text-[13px] text-[var(--v-apagado)]">{p.versao}</p>}
      <div className="mt-10 space-y-4">
        {blocos.map((b, i) => (
          <section key={i} className="cartao-v px-6 py-6 sm:px-8">
            {b.titulo && <h2 className="font-titulo text-[1.7rem] leading-tight text-[var(--v-texto)]">{b.titulo}</h2>}
            {b.texto.map((par, j) => (
              <p key={j} className={`${b.titulo || j > 0 ? "mt-3" : ""} text-[15px] leading-relaxed text-[var(--v-suave)]`}>
                {par}
              </p>
            ))}
            {b.lista.length > 0 && (
              <ul className="mt-3 space-y-2">
                {b.lista.map((item, j) => (
                  <li key={j} className="flex gap-3 text-[15px] leading-relaxed text-[var(--v-suave)]">
                    <span className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-[var(--v-acento)]" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href={`${base}/catalogo`} className="botao-v">
          Ver o catálogo
        </Link>
        {loja.whatsapp && (
          <a href={linkWhatsapp(loja.whatsapp, `Olá! Vim pela página "${p.titulo}" do site.`)} target="_blank" rel="noopener" className="botao-v-contorno">
            Falar no WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
