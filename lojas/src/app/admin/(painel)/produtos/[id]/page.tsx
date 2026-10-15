/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { produtoImagens, produtos, variantes } from "@/db/schema";
import { contexto } from "@/lib/painel";
import { categoriasDaLoja, produtoPorSlug, todasAsMarcas } from "@/lib/catalogo";
import { legendaInstagram } from "@/lib/divulgacao";
import { marcasDeTerceiros, textosDoProduto } from "@/lib/marcas";
import { Copiar } from "@/components/loja/Copiar";
import { reaisParaCampo } from "@/lib/dinheiro";
import { urlDaLoja } from "@/lib/dominios";
import { Aviso, Cabecalho, Cartao } from "@/components/admin/ui";
import { Confirmar } from "@/components/admin/Botoes";
import { ProdutoForm } from "@/components/admin/ProdutoForm";
import { acaoExcluirProduto, acaoFotoPrincipal, acaoRemoverFoto, acaoSalvarProduto } from "../acoes";

export default async function EditarProduto({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { loja } = await contexto();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [p] = await db.select().from(produtos).where(and(eq(produtos.id, id), eq(produtos.lojaId, loja.id)));
  if (!p) notFound();
  const [vs, imgs, cats, marcas] = await Promise.all([
    db.select().from(variantes).where(eq(variantes.produtoId, id)).orderBy(asc(variantes.ordem), asc(variantes.id)),
    db.select().from(produtoImagens).where(eq(produtoImagens.produtoId, id)).orderBy(asc(produtoImagens.ordem), asc(produtoImagens.id)),
    categoriasDaLoja(loja.id),
    todasAsMarcas(loja.id),
  ]);
  const sp = await searchParams;
  const citadas = marcasDeTerceiros(...textosDoProduto({ ...p, variantes: vs }));
  const vitrine = p.ativo ? await produtoPorSlug(loja.id, p.slug) : null;
  const legenda = vitrine
    ? legendaInstagram(loja, vitrine, `${urlDaLoja(loja.slug)}/produto/${p.slug}`, cats.find((c) => c.id === p.categoriaId)?.nome)
    : "";
  return (
    <>
      <Cabecalho titulo={p.nome} voltar="/admin/produtos">
        {p.ativo && (
          <Link href={`${urlDaLoja(loja.slug)}/produto/${p.slug}`} target="_blank" className="botao-secundario">
            Ver no site
          </Link>
        )}
      </Cabecalho>
      <Aviso ok={sp.ok} erro={sp.erro} />
      {citadas.length > 0 && (
        <p className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
          Este produto cita outra marca: <b>{citadas.join(", ")}</b>. Para vender como coleção própria, tire esses nomes do título, da descrição,
          da ficha e das variações. Enquanto citar, ele fica fora do feed do Google e do Instagram e não pode ser publicado no Mercado Livre.
        </p>
      )}
      <div className="space-y-6">
        {imgs.length > 0 && (
          <Cartao titulo="Fotos">
            <ul className="flex flex-wrap gap-3">
              {imgs.map((img, i) => (
                <li key={img.id} className="w-24 text-center text-xs">
                  <img src={img.url} alt="" className={`h-24 w-24 rounded-md object-cover ${i === 0 ? "ring-2 ring-stone-900" : ""}`} />
                  <div className="mt-1 flex justify-center gap-2">
                    {i > 0 && (
                      <form action={acaoFotoPrincipal}>
                        <input type="hidden" name="produtoId" value={p.id} />
                        <input type="hidden" name="imagemId" value={img.id} />
                        <button className="underline">capa</button>
                      </form>
                    )}
                    <form action={acaoRemoverFoto}>
                      <input type="hidden" name="produtoId" value={p.id} />
                      <input type="hidden" name="imagemId" value={img.id} />
                      <button className="text-red-600 underline">remover</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </Cartao>
        )}

        <ProdutoForm
          acao={acaoSalvarProduto}
          categorias={cats}
          marcas={marcas}
          produto={p}
          variantes={vs.map((v) => ({
            id: v.id,
            nome: v.nome,
            sku: v.sku ?? "",
            codigoBarras: v.codigoBarras ?? "",
            preco: reaisParaCampo(v.precoCentavos),
            precoDe: reaisParaCampo(v.precoDeCentavos),
            custo: reaisParaCampo(v.custoCentavos),
            estoque: String(v.estoque),
            ativo: v.ativo,
          }))}
        />

        {vitrine && (
          <details className="rounded-lg border border-stone-200 bg-white p-4 sm:p-5">
            <summary className="cursor-pointer text-sm font-semibold">Divulgar no Instagram e no WhatsApp</summary>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_260px]">
              <pre className="whitespace-pre-wrap rounded-md bg-stone-50 p-3 font-sans text-sm text-stone-700">{legenda}</pre>
              <div className="space-y-2">
                <Copiar texto={legenda} rotulo="Copiar legenda" />
                <a href={`https://wa.me/?text=${encodeURIComponent(legenda)}`} target="_blank" rel="noopener" className="botao-secundario w-full">
                  Mandar no WhatsApp
                </a>
                {imgs[0] && (
                  <a href={imgs[0].url} download className="botao-secundario w-full">
                    Baixar a foto de capa
                  </a>
                )}
                <p className="text-xs text-stone-500">Pelo Telegram, peça à Kira: &quot;divulga o {p.nome} no Instagram&quot;. Ela busca a foto, o link e esta legenda.</p>
              </div>
            </div>
          </details>
        )}

        <form action={acaoExcluirProduto} className="border-t border-stone-200 pt-6">
          <input type="hidden" name="id" value={p.id} />
          <Confirmar pergunta="Excluir este produto de vez?">Excluir produto</Confirmar>
        </form>
      </div>
    </>
  );
}
