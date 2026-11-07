import Link from "next/link";
import type { Loja } from "@/db/schema";
import type { ProdutoVitrine } from "@/lib/catalogo";
import { formatarReais } from "@/lib/dinheiro";
import type { Painel, VisualLoja } from "@/lib/visual";
import type { Categoria } from "./tipos";
import { CarrosselProdutos, GradeProdutos } from "./CartaoProduto";

type Props = {
  loja: Loja;
  base: string;
  visual: VisualLoja;
  categorias: (Categoria & { capa?: string; total: number })[];
  novidades: ProdutoVitrine[];
  destaques: ProdutoVitrine[];
  totalPecas: number;
};

function CartaoPainel({ painel, base, alto = false }: { painel: Painel; base: string; alto?: boolean }) {
  return (
    <Link
      href={`${base}/categoria/${painel.categoria}`}
      className={`painel-j group relative block overflow-hidden ${alto ? "aspect-[4/5] sm:aspect-[2/1] lg:aspect-[5/2]" : "aspect-[4/3] sm:aspect-[2/1]"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={painel.imagem} alt="" className="absolute inset-0 h-full w-full object-cover object-right transition duration-1000 ease-out group-hover:scale-[1.03]" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b0c]/85 via-[#0b0b0c]/35 to-transparent" />
      <div className="relative flex h-full flex-col justify-center px-7 sm:px-10">
        <h3 className="font-titulo text-4xl text-[#f3efe6] sm:text-5xl">{painel.titulo}</h3>
        <p className="mt-3 max-w-[14rem] text-[11px] uppercase leading-relaxed tracking-[0.2em] text-[#f3efe6]/85">{painel.frase}</p>
        <span className="mt-5 text-xl text-[#f3efe6] transition group-hover:translate-x-1" aria-hidden>
          →
        </span>
      </div>
    </Link>
  );
}

const SERVICOS = [
  { icone: "M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3Zm-3 9 2 2 4-4", titulo: "Banho de ouro 18k", texto: "Brilho que dura, com acabamento antialérgico." },
  { icone: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z", titulo: "Entrega", texto: "" },
  { icone: "M3 6h18v12H3zM3 10h18M7 15h3", titulo: "Pagamento", texto: "Pix, cartão de crédito ou boleto, com compra segura." },
  { icone: "M4 12a8 8 0 1 0 2.3-5.6M4 4v3h3", titulo: "Troca e garantia", texto: "7 dias para trocar e 90 dias de garantia." },
];

/** início da Infinite: abertura com foto, coleções em painéis, novidades, linha masculina e serviços */
export function InicioJoalheria({ loja, base, visual, categorias, novidades, destaques, totalPecas }: Props) {
  const abertura = visual.abertura;
  const instagram = loja.instagram?.replace(/^@/, "");
  const gratis = loja.frete.entrega.ativo ? loja.frete.entrega.gratisAcimaCentavos : null;
  const slugs = new Set(categorias.map((c) => c.slug));
  const paineis = (visual.paineis ?? []).filter((p) => slugs.has(p.categoria));
  const destaque = visual.destaque && slugs.has(visual.destaque.categoria) ? visual.destaque : null;
  const servicos = SERVICOS.map((s) =>
    s.titulo === "Entrega" ? { ...s, texto: gratis != null ? `Para todo o Brasil, grátis a partir de ${formatarReais(gratis)}.` : "Para todo o Brasil, com rastreio." } : s,
  );

  return (
    <>
      {/* abertura */}
      <section className="mx-auto max-w-[1440px] px-5 pt-4 sm:px-10">
        <div className="painel-j relative overflow-hidden">
          {abertura && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={abertura.imagem} alt="" className="absolute inset-0 h-full w-full object-cover object-[70%_center]" fetchPriority="high" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0c]/90 via-[#0b0b0c]/30 to-transparent sm:bg-gradient-to-r sm:from-[#0b0b0c]/90 sm:via-[#0b0b0c]/45" />
          <div className="relative flex min-h-[560px] flex-col justify-end px-7 pb-12 pt-40 sm:min-h-[420px] sm:justify-center sm:px-14 sm:py-20 lg:min-h-[480px]">
            <h1 className="font-titulo text-[3.1rem] leading-[0.98] text-[#f3efe6] sm:text-7xl lg:text-[5.4rem]">
              {abertura ? abertura.titulo.map((l) => <span key={l} className="block">{l}</span>) : loja.slogan ?? loja.nome}
            </h1>
            <p className="mt-6 max-w-xs text-[15px] leading-relaxed text-[#f3efe6]/90">{abertura?.frase ?? loja.sobre}</p>
            <div className="mt-8">
              <Link href={`${base}/catalogo`} className="botao-ouro">
                {abertura?.botao ?? "Ver peças"} <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* coleções */}
      <section id="colecoes" className="mx-auto max-w-[1440px] scroll-mt-24 px-5 pt-20 sm:px-10">
        <div className="mb-8 flex items-end gap-6">
          <div>
            <p className="sobrelinha-j">Nossas</p>
            <h2 className="mt-1 font-titulo text-4xl text-[#f3efe6] sm:text-5xl">Coleções</h2>
          </div>
          <span className="mb-4 hidden h-px flex-1 bg-[#30302d] sm:block" />
          <p className="mb-2 hidden max-w-[13rem] text-right text-[11px] uppercase leading-relaxed tracking-[0.2em] text-[#c2bdb4] sm:block">
            Diferentes formas de expressar o que te faz única.
          </p>
        </div>
        {paineis.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {paineis.map((p) => (
              <CartaoPainel key={p.categoria} painel={p} base={base} />
            ))}
          </div>
        )}
        <div className="sem-barra -mx-5 mt-4 flex snap-x gap-3 overflow-x-auto px-5 sm:-mx-10 sm:px-10">
          {categorias.map((c) => (
            <Link key={c.id} href={`${base}/categoria/${c.slug}`} className="painel-j group flex shrink-0 snap-start items-center gap-3 py-2 pl-2 pr-5 transition hover:border-[#b89a67]/50">
              <span className="h-11 w-11 overflow-hidden rounded-full bg-[#1c1c1c]">
                {c.capa && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.capa} alt="" className="h-full w-full object-cover" loading="lazy" />
                )}
              </span>
              <span>
                <span className="block text-[14px] text-[#f3efe6] group-hover:text-[#c5a978]">{c.nome}</span>
                <span className="block text-[12px] text-[#8a857c]">
                  {c.total} {c.total === 1 ? "peça" : "peças"}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* novidades */}
      {novidades.length > 0 && (
        <section className="mx-auto max-w-[1440px] px-5 pt-20 sm:px-10">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="sobrelinha-j">Acabaram de chegar</p>
              <h2 className="mt-1 font-titulo text-4xl text-[#f3efe6] sm:text-5xl">Novidades</h2>
            </div>
            <Link href={`${base}/catalogo?ordem=novidades`} className="text-[14px] text-[#c2bdb4] hover:text-[#f3efe6]">
              Ver todas as {totalPecas} peças <span aria-hidden>→</span>
            </Link>
          </div>
          <GradeProdutos produtos={novidades} base={base} condicoes={loja} variante="joalheria" />
        </section>
      )}

      {/* painel largo (linha masculina) */}
      {destaque && (
        <section className="mx-auto max-w-[1440px] px-5 pt-20 sm:px-10">
          <CartaoPainel painel={destaque} base={base} alto />
        </section>
      )}

      {/* mais desejadas */}
      {destaques.length > 0 && (
        <section className="mx-auto max-w-[1440px] px-5 pt-20 sm:px-10">
          <div className="mb-8">
            <p className="sobrelinha-j">Seleção</p>
            <h2 className="mt-1 font-titulo text-4xl text-[#f3efe6] sm:text-5xl">As mais desejadas</h2>
          </div>
          <CarrosselProdutos produtos={destaques} base={base} condicoes={loja} variante="joalheria" />
        </section>
      )}

      {/* serviços */}
      <section className="mx-auto max-w-[1440px] px-5 pt-20 sm:px-10">
        <ul className="painel-j grid gap-8 px-6 py-10 sm:grid-cols-2 sm:px-10 lg:grid-cols-4">
          {servicos.map((s) => (
            <li key={s.titulo}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#b89a67" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={s.icone} />
              </svg>
              <p className="mt-3 text-[15px] text-[#f3efe6]">{s.titulo}</p>
              <p className="mt-1 text-[14px] leading-relaxed text-[#c2bdb4]">{s.texto}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Instagram */}
      {instagram && (
        <section className="mx-auto max-w-3xl px-6 pt-24 text-center">
          <p className="sobrelinha-j">Lançamentos em primeira mão</p>
          <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noopener" className="mt-4 block font-titulo text-4xl text-[#f3efe6] transition hover:text-[#c5a978] sm:text-5xl">
            @{instagram}
          </a>
        </section>
      )}
    </>
  );
}
