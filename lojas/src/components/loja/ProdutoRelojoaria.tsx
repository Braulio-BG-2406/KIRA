import Link from "next/link";
import type { Loja } from "@/db/schema";
import type { ProdutoVitrine } from "@/lib/catalogo";
import { formatarReais } from "@/lib/dinheiro";
import { linkWhatsapp } from "@/lib/texto";
import { parcela } from "@/lib/precos";
import { Comprar } from "./Comprar";
import { CarrosselProdutos } from "./CartaoProduto";
import { DesenhoRelogio } from "./DesenhoRelogio";
import { Galeria } from "./Galeria";

function Secao({ titulo, aberta = false, children }: { titulo: string; aberta?: boolean; children: React.ReactNode }) {
  return (
    <details className="group border-t border-stone-200" open={aberta}>
      <summary className="flex cursor-pointer list-none items-center justify-between py-5 text-[15px] text-stone-900 [&::-webkit-details-marker]:hidden">
        {titulo}
        <span className="text-xl font-light text-stone-400 transition group-open:rotate-45" aria-hidden>
          +
        </span>
      </summary>
      <div className="pb-6 text-[15px] font-light leading-relaxed text-stone-600">{children}</div>
    </details>
  );
}

/** página de produto de relojoaria: peça grande em areia, texto fino e informações em seções */
export function ProdutoRelojoaria({
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
  const parc = parcela(p.precoMin, loja.parcelasSemJuros);
  return (
    <>
      <div className="mx-auto max-w-[1440px] md:grid md:grid-cols-[1.2fr_1fr]">
        <div className="bg-areia md:sticky md:top-[72px] md:h-[calc(100svh-72px)] md:self-start">
          {p.imagens.length ? (
            <div className="h-full p-0 md:p-10">
              <Galeria imagens={p.imagens} nome={p.nome} relojoaria />
            </div>
          ) : (
            <div role="img" aria-label={p.nome} className="flex aspect-square items-center justify-center bg-[radial-gradient(circle_at_50%_45%,#ffffff_0%,#f4f1ec_62%)] md:aspect-auto md:h-full">
              <DesenhoRelogio traco={0.8} className="h-[62%] w-auto text-stone-800/70" />
            </div>
          )}
        </div>

        <div className="px-6 py-10 sm:px-12 md:py-16 lg:px-20">
          <nav className="text-[13px] font-light text-stone-500">
            <Link href={base || "/"} className="hover:text-stone-900">
              Início
            </Link>
            {categoria && (
              <>
                <span className="mx-2">/</span>
                <Link href={`${base}/categoria/${categoria.slug}`} className="hover:text-stone-900">
                  {categoria.nome}
                </Link>
              </>
            )}
          </nav>
          {p.marca && <p className="sobrelinha mt-10 text-destaque">{p.marca}</p>}
          <h1 className={`${p.marca ? "mt-4" : "mt-10"} font-titulo text-4xl leading-[1.08] text-stone-950 sm:text-5xl`}>{p.nome}</h1>
          <div className="mt-8">
            <Comprar
              slug={loja.slug}
              base={base}
              descontoPixPct={loja.pixChave ? loja.descontoPixPct : 0}
              parcelasSemJuros={loja.parcelasSemJuros}
              refinado
              variantes={p.variantes.map((v) => ({ id: v.id, nome: v.nome, precoCentavos: v.precoCentavos, precoDeCentavos: v.precoDeCentavos, estoque: v.estoque }))}
            />
          </div>

          <div className="mt-12 border-b border-stone-200">
            {p.descricao && (
              <Secao titulo="Sobre a peça" aberta>
                <p className="whitespace-pre-line">{p.descricao}</p>
              </Secao>
            )}
            {p.especificacoes.length > 0 && (
              <Secao titulo="Ficha técnica" aberta={!p.descricao}>
                <dl>
                  {p.especificacoes.map((e) => (
                    <div key={e.nome} className="flex justify-between gap-6 border-b border-stone-100 py-2.5 last:border-0">
                      <dt className="text-stone-500">{e.nome}</dt>
                      <dd className="text-right text-stone-900">{e.valor}</dd>
                    </div>
                  ))}
                </dl>
              </Secao>
            )}
            {(p.garantia || p.itensInclusos) && (
              <Secao titulo="Garantia e o que vem na caixa">
                {p.garantia && <p>Garantia: {p.garantia}.</p>}
                {p.itensInclusos && <p className="mt-1">Vem com: {p.itensInclusos}.</p>}
              </Secao>
            )}
            <Secao titulo="Entrega, troca e pagamento">
              <ul className="space-y-1.5">
                {entrega.ativo && (
                  <li>
                    Envio para todo o Brasil com rastreio, {entrega.prazo}.
                    {entrega.gratisAcimaCentavos != null && ` Grátis acima de ${formatarReais(entrega.gratisAcimaCentavos)}.`}
                  </li>
                )}
                {loja.frete.retirada.ativo && <li>Retirada: {loja.frete.retirada.endereco || "combine pelo WhatsApp"}.</li>}
                <li>Até 7 dias depois de receber para trocar ou devolver.</li>
                {loja.pixChave && loja.descontoPixPct > 0 && <li>{loja.descontoPixPct}% de desconto no Pix.</li>}
                {parc && <li>Ou em até {parc.vezes}x sem juros no cartão.</li>}
              </ul>
            </Secao>
          </div>

          {loja.whatsapp && (
            <a href={linkWhatsapp(loja.whatsapp, `Olá! Tenho uma dúvida sobre ${p.nome}.`)} target="_blank" rel="noopener" className="link-seta mt-10 text-stone-700">
              Falar com um consultor no WhatsApp <span aria-hidden>→</span>
            </a>
          )}
        </div>
      </div>

      {parecidos.length > 0 && (
        <section className="mx-auto max-w-[1440px] px-5 py-24 sm:px-10">
          <h2 className="mb-10 text-center font-titulo text-3xl text-stone-950">Você também pode gostar</h2>
          <CarrosselProdutos produtos={parecidos} base={base} condicoes={loja} />
        </section>
      )}
    </>
  );
}
