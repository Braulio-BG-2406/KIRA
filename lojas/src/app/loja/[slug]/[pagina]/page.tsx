import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { baseDaLoja, buscarLoja } from "@/lib/lojas";
import { paginasDaLoja, preencher } from "@/lib/paginas";
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
  const t = (s: string) => preencher(s, loja);
  const ajuda = paginas.filter((x) => x.grupo === p.grupo);
  return (
    <div className="mx-auto max-w-[1100px] px-5 pt-10 sm:px-10">
      {ajuda.length > 1 && (
        <nav className="sem-barra -mx-5 mb-10 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:px-0" aria-label="Páginas">
          {ajuda.map((x) => (
            <Link
              key={x.slug}
              href={`${base}/${x.slug}`}
              aria-current={x.slug === p.slug ? "page" : undefined}
              className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-[13px] transition ${x.slug === p.slug ? "border-[#b89a67] bg-[#b89a67]/12 text-[#f3efe6]" : "border-[#30302d] text-[#c2bdb4] hover:text-[#f3efe6]"}`}
            >
              {x.titulo}
            </Link>
          ))}
        </nav>
      )}
      <h1 className="font-titulo text-5xl text-[#f3efe6] sm:text-6xl">{p.titulo}</h1>
      {p.subtitulo && <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-[#c2bdb4]">{t(p.subtitulo)}</p>}
      {p.versao && <p className="mt-2 text-[13px] text-[#8a857c]">{p.versao}</p>}
      <div className="mt-10 space-y-4">
        {p.blocos.map((b, i) => (
          <section key={i} className="painel-j px-6 py-6 sm:px-8">
            {b.titulo && <h2 className="font-titulo text-[1.7rem] leading-tight text-[#f3efe6]">{t(b.titulo)}</h2>}
            {b.texto?.map((par, j) => (
              <p key={j} className={`${b.titulo || j > 0 ? "mt-3" : ""} text-[15px] leading-relaxed text-[#c2bdb4]`}>
                {t(par)}
              </p>
            ))}
            {b.lista && (
              <ul className="mt-3 space-y-2">
                {b.lista.map((item, j) => (
                  <li key={j} className="flex gap-3 text-[15px] leading-relaxed text-[#c2bdb4]">
                    <span className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-[#b89a67]" aria-hidden />
                    {t(item)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href={`${base}/catalogo`} className="botao-ouro">
          Ver o catálogo
        </Link>
        {loja.whatsapp && (
          <a href={linkWhatsapp(loja.whatsapp, `Olá! Vim pela página "${p.titulo}" do site.`)} target="_blank" rel="noopener" className="botao-contorno">
            Falar no WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
