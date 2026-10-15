/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { and, asc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { produtoImagens, produtos, variantes } from "@/db/schema";
import { contexto } from "@/lib/painel";
import { categoriasDaLoja } from "@/lib/catalogo";
import { formatarReais } from "@/lib/dinheiro";
import { marcasDeTerceiros, textosDoProduto } from "@/lib/marcas";
import { Aviso, Cabecalho, Cartao, Tabela, Vazio } from "@/components/admin/ui";

export default async function Produtos({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { loja } = await contexto();
  const sp = await searchParams;
  const busca = sp.q?.trim() ?? "";
  const categoriaId = parseInt(sp.categoria ?? "", 10) || null;
  const filtros: SQL[] = [eq(produtos.lojaId, loja.id)];
  if (categoriaId) filtros.push(eq(produtos.categoriaId, categoriaId));
  if (busca) {
    const termo = `%${busca.replace(/[%_\\]/g, "\\$&")}%`;
    const comSku = db.select({ id: variantes.produtoId }).from(variantes).where(ilike(variantes.sku, termo));
    filtros.push(or(ilike(produtos.nome, termo), inArray(produtos.id, comSku))!);
  }
  const [lista, cats] = await Promise.all([
    db.select().from(produtos).where(and(...filtros)).orderBy(asc(produtos.nome)).limit(500),
    categoriasDaLoja(loja.id),
  ]);
  const ids = lista.map((p) => p.id);
  const [vs, imgs] = ids.length
    ? await Promise.all([
        db.select().from(variantes).where(inArray(variantes.produtoId, ids)),
        db.select().from(produtoImagens).where(inArray(produtoImagens.produtoId, ids)).orderBy(asc(produtoImagens.ordem), asc(produtoImagens.id)),
      ])
    : [[], []];

  return (
    <>
      <Cabecalho titulo="Produtos">
        <Link href="/admin/produtos/novo" className="botao-primario">Novo produto</Link>
      </Cabecalho>
      <Aviso ok={sp.ok} erro={sp.erro} />
      <Cartao>
        <form className="mb-4 flex flex-wrap gap-2">
          <input name="q" defaultValue={busca} placeholder="Nome ou SKU" className="campo max-w-xs" />
          <select name="categoria" defaultValue={categoriaId ?? ""} className="campo w-auto">
            <option value="">Todas as categorias</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <button className="botao-secundario">Filtrar</button>
        </form>
        {lista.length === 0 ? (
          <Vazio>Nenhum produto. Cadastre o primeiro ou importe uma planilha.</Vazio>
        ) : (
          <Tabela>
            <thead>
              <tr>
                <th className="w-14"></th>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Preço</th>
                <th className="text-right">Estoque</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => {
                const pv = vs.filter((v) => v.produtoId === p.id && v.ativo);
                const precos = pv.map((v) => v.precoCentavos);
                const estoque = pv.reduce((s, v) => s + v.estoque, 0);
                const foto = imgs.find((i) => i.produtoId === p.id);
                return (
                  <tr key={p.id} className="hover:bg-stone-50">
                    <td>
                      {foto ? <img src={foto.url} alt="" className="h-10 w-10 rounded object-cover" /> : <div className="h-10 w-10 rounded bg-stone-100" />}
                    </td>
                    <td>
                      <Link href={`/admin/produtos/${p.id}`} className="font-medium hover:underline">{p.nome}</Link>
                      {p.destaque && <span className="ml-2 text-xs text-amber-600">★ destaque</span>}
                      {marcasDeTerceiros(...textosDoProduto({ ...p, variantes: pv })).length > 0 && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">cita outra marca</span>
                      )}
                      {pv.length > 1 && <span className="block text-xs text-stone-500">{pv.length} variações</span>}
                    </td>
                    <td className="text-stone-600">{cats.find((c) => c.id === p.categoriaId)?.nome ?? "—"}</td>
                    <td className="whitespace-nowrap tabular-nums">
                      {precos.length ? formatarReais(Math.min(...precos)) : "—"}
                      {precos.length > 1 && Math.max(...precos) !== Math.min(...precos) && ` a ${formatarReais(Math.max(...precos))}`}
                    </td>
                    <td className={`text-right tabular-nums ${estoque <= 0 ? "text-red-600" : estoque <= loja.estoqueMinimo ? "text-amber-700" : ""}`}>{estoque}</td>
                    <td>{p.ativo ? <span className="text-green-700">À venda</span> : <span className="text-stone-400">Oculto</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </Tabela>
        )}
      </Cartao>
    </>
  );
}
