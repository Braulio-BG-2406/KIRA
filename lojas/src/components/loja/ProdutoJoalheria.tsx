import Link from "next/link";
import type { Loja } from "@/db/schema";
import type { ProdutoVitrine } from "@/lib/catalogo";
import { formatarReais } from "@/lib/dinheiro";
import { linkWhatsapp } from "@/lib/texto";
import { Comprar } from "./Comprar";
import { CarrosselProdutos } from "./CartaoProduto";
import { Galeria } from "./Galeria";

function Cartao({ titulo, children, icone }: { titulo: string; children: React.ReactNode; icone: string }) {
  return (
    <div className="painel-j px-5 py-4">
      <p className="flex items-center gap-2.5 text-[15px] text-[#f3efe6]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d={icone} />
        </svg>
        {titulo}
      </p>
      <div className="mt-1.5 text-[14px] leading-relaxed text-[#c2bdb4]">{children}</div>
    </div>
  );
}

/** página de produto escura: foto em painel, opções em pílulas, sacola e compra direta, condições em cartões */
export function ProdutoJoalheria({
  loja,
  p,
  base,
  categoria,
  parecidos,
}: {
  loja: Loja;
  p: ProdutoVitrine;
  base: string;
  categoria?: { nome: string; slug: string };
  parecidos: ProdutoVitrine[];
}) {
  const entrega = loja.frete.entrega;
  const codigo = p.variantes[0]?.sku;
  const poucas = p.estoqueTotal > 0 && p.estoqueTotal <= 3;
  return (
    <>
      <div className="mx-auto max-w-[1440px] px-5 pt-6 sm:px-10">
        <nav className="text-[13px] text-[#c2bdb4]" aria-label="Você está em">
          <Link href={`${base}/catalogo`} className="hover:text-[#f3efe6]">
            Catálogo
          </Link>
          {categoria && (
            <>
              <span className="mx-2 text-[#8a857c]">/</span>
              <Link href={`${base}/categoria/${categoria.slug}`} className="hover:text-[#f3efe6]">
                {categoria.nome}
              </Link>
            </>
          )}
          <span className="mx-2 text-[#8a857c]">/</span>
          <span className="text-[#8a857c]">{p.nome}</span>
        </nav>

        <article className="mt-6 grid gap-10 md:grid-cols-[1.1fr_1fr] lg:gap-14">
          <div className="md:sticky md:top-[92px] md:self-start">
            <Galeria imagens={p.imagens} nome={p.nome} joalheria />
          </div>

          <div>
            {categoria && <p className="sobrelinha-j">{categoria.nome}</p>}
            <h1 className="mt-3 font-titulo text-[2.6rem] uppercase leading-[1.05] text-[#f3efe6] sm:text-5xl">{p.nome}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px]">
              {p.estoqueTotal <= 0 ? (
                <span className="rounded-full border border-[#30302d] px-3 py-1 text-[#c2bdb4]">Esgotado</span>
              ) : poucas ? (
                <span className="rounded-full border border-[#b89a67]/50 px-3 py-1 text-[#c5a978]">Últimas unidades</span>
              ) : null}
              {codigo && <span className="text-[#8a857c]">Cód. {codigo}</span>}
            </div>

            <div className="mt-6">
              <Comprar
                slug={loja.slug}
                base={base}
                descontoPixPct={loja.pixChave ? loja.descontoPixPct : 0}
                parcelasSemJuros={loja.parcelasSemJuros}
                joalheria
                variantes={p.variantes.map((v) => ({ id: v.id, nome: v.nome, precoCentavos: v.precoCentavos, precoDeCentavos: v.precoDeCentavos, estoque: v.estoque }))}
              />
            </div>

            {loja.whatsapp && (
              <a
                href={linkWhatsapp(loja.whatsapp, `Olá! Tenho uma dúvida sobre ${p.nome}${codigo ? ` (cód. ${codigo})` : ""}.`)}
                target="_blank"
                rel="noopener"
                className="mt-5 inline-flex items-center gap-2 text-[14px] text-[#c2bdb4] hover:text-[#f3efe6]"
              >
                Tirar dúvidas pelo WhatsApp <span aria-hidden>→</span>
              </a>
            )}

            <div className="mt-8 grid gap-3">
              {entrega.ativo && (
                <Cartao titulo="Frete e prazo" icone="M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z">
                  {entrega.gratisAcimaCentavos != null && <p className="text-[#9bc59d]">Frete grátis a partir de {formatarReais(entrega.gratisAcimaCentavos)} em peças.</p>}
                  <p>Para todo o Brasil, com rastreio, {entrega.prazo}. O valor aparece no checkout.</p>
                </Cartao>
              )}
              <Cartao titulo={p.garantia ? `Garantia: ${p.garantia}` : "Garantia legal de 90 dias"} icone="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3Zm-3 9 2 2 4-4">
                <p>Contra defeitos de fabricação, conforme o Código de Defesa do Consumidor.</p>
              </Cartao>
              <Cartao titulo="Troca e devolução" icone="M4 12a8 8 0 1 0 2.3-5.6M4 4v3h3">
                <p>
                  7 dias para desistir da compra.{" "}
                  <Link href={`${base}/troca-e-devolucao`} className="text-[#c5a978] underline underline-offset-4">
                    Ver política
                  </Link>
                </p>
              </Cartao>
              <Cartao titulo="Compra segura" icone="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4">
                <p>Pix, cartão ou boleto. Os dados do cartão não ficam com a loja.</p>
              </Cartao>
            </div>

            {(p.descricao || p.especificacoes.length > 0) && (
              <section className="mt-10 border-t border-[#30302d] pt-8">
                {p.descricao && (
                  <>
                    <h2 className="font-titulo text-2xl text-[#f3efe6]">Descrição</h2>
                    <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-[#c2bdb4]">{p.descricao}</p>
                  </>
                )}
                {p.especificacoes.length > 0 && (
                  <>
                    <h2 className="mt-8 font-titulo text-2xl text-[#f3efe6]">Especificações</h2>
                    <dl className="mt-3 text-[14px]">
                      {p.especificacoes.map((e) => (
                        <div key={e.nome} className="flex justify-between gap-6 border-b border-[#30302d] py-2.5">
                          <dt className="text-[#8a857c]">{e.nome}</dt>
                          <dd className="text-right text-[#f3efe6]">{e.valor}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}
              </section>
            )}
          </div>
        </article>
      </div>

      {parecidos.length > 0 && (
        <section className="mx-auto max-w-[1440px] px-5 pt-20 sm:px-10">
          <h2 className="mb-8 font-titulo text-3xl text-[#f3efe6] sm:text-4xl">Você também pode gostar</h2>
          <CarrosselProdutos produtos={parecidos} base={base} condicoes={loja} variante="joalheria" />
        </section>
      )}
    </>
  );
}
