/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { produtoImagens, produtos, variantes } from "@/db/schema";
import { contexto } from "@/lib/painel";
import { categoriasDaLoja } from "@/lib/catalogo";
import { reaisParaCampo } from "@/lib/dinheiro";
import { urlDaLoja } from "@/lib/dominios";
import { Aviso, Cabecalho, Cartao } from "@/components/admin/ui";
import { Confirmar, Enviar } from "@/components/admin/Botoes";
import { ProdutoForm } from "@/components/admin/ProdutoForm";
import { acaoEnviarFotos, acaoExcluirProduto, acaoFotoPrincipal, acaoRemoverFoto, acaoSalvarProduto } from "../acoes";

export default async function EditarProduto({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { loja } = await contexto();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [p] = await db.select().from(produtos).where(and(eq(produtos.id, id), eq(produtos.lojaId, loja.id)));
  if (!p) notFound();
  const [vs, imgs, cats] = await Promise.all([
    db.select().from(variantes).where(eq(variantes.produtoId, id)).orderBy(asc(variantes.ordem), asc(variantes.id)),
    db.select().from(produtoImagens).where(eq(produtoImagens.produtoId, id)).orderBy(asc(produtoImagens.ordem), asc(produtoImagens.id)),
    categoriasDaLoja(loja.id),
  ]);
  const sp = await searchParams;
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
      <div className="space-y-6">
        <Cartao titulo="Fotos">
          {imgs.length > 0 && (
            <ul className="mb-4 flex flex-wrap gap-3">
              {imgs.map((img, i) => (
                <li key={img.id} className="w-28 text-center text-xs">
                  <img src={img.url} alt="" className={`h-28 w-28 rounded-md object-cover ${i === 0 ? "ring-2 ring-stone-900" : ""}`} />
                  <div className="mt-1 flex justify-center gap-2">
                    {i > 0 && (
                      <form action={acaoFotoPrincipal}>
                        <input type="hidden" name="produtoId" value={p.id} />
                        <input type="hidden" name="imagemId" value={img.id} />
                        <button className="underline">principal</button>
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
          )}
          <form action={acaoEnviarFotos} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={p.id} />
            <input type="file" name="fotos" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="text-sm" />
            <Enviar className="botao-secundario" pendente="Enviando…">Enviar fotos</Enviar>
          </form>
          <p className="mt-2 text-xs text-stone-500">JPG, PNG ou WEBP até 8 MB. Fotos quadradas ficam melhores na vitrine.</p>
        </Cartao>

        <ProdutoForm
          acao={acaoSalvarProduto}
          categorias={cats}
          produto={p}
          variantes={vs.map((v) => ({
            id: v.id,
            nome: v.nome,
            sku: v.sku ?? "",
            preco: reaisParaCampo(v.precoCentavos),
            precoDe: reaisParaCampo(v.precoDeCentavos),
            custo: reaisParaCampo(v.custoCentavos),
            estoque: String(v.estoque),
            ativo: v.ativo,
          }))}
        />

        <form action={acaoExcluirProduto} className="border-t border-stone-200 pt-6">
          <input type="hidden" name="id" value={p.id} />
          <Confirmar pergunta="Excluir este produto de vez?">Excluir produto</Confirmar>
        </form>
      </div>
    </>
  );
}
