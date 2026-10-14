import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { movimentosEstoque, produtos, variantes } from "@/db/schema";
import { contexto, executar, inteiro, texto } from "@/lib/painel";
import { estoqueBaixo } from "@/lib/consultas";
import { ajustarEstoque } from "@/lib/estoque";
import { opcoesDeVariantes } from "@/lib/opcoes";
import { formatarDataHora } from "@/lib/datas";
import { Aviso, Cabecalho, Cartao, Tabela, Vazio } from "@/components/admin/ui";
import { AjusteEstoque } from "@/components/admin/AjusteEstoque";

const TIPOS: Record<string, string> = { entrada: "Entrada", saida: "Saída", ajuste: "Ajuste", venda: "Venda", cancelamento: "Cancelamento", compra: "Compra" };

async function acaoAjustar(fd: FormData) {
  "use server";
  const { loja } = await contexto();
  await executar("/admin/estoque", async () => {
    const modo = texto(fd, "modo") as "entrada" | "saida" | "contagem";
    await ajustarEstoque({ lojaId: loja.id, varianteId: inteiro(fd, "varianteId"), modo: ["entrada", "saida", "contagem"].includes(modo) ? modo : "entrada", quantidade: inteiro(fd, "quantidade", -1), nota: texto(fd, "nota") });
  }, "Estoque atualizado.");
}

export default async function Estoque({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { loja } = await contexto();
  const [baixo, opcoes, movimentos, sp] = await Promise.all([
    estoqueBaixo(loja, 100),
    opcoesDeVariantes(loja.id, true),
    db
      .select({ m: movimentosEstoque, produto: produtos.nome, variante: variantes.nome, produtoId: produtos.id })
      .from(movimentosEstoque)
      .innerJoin(variantes, eq(variantes.id, movimentosEstoque.varianteId))
      .innerJoin(produtos, eq(produtos.id, variantes.produtoId))
      .where(eq(movimentosEstoque.lojaId, loja.id))
      .orderBy(desc(movimentosEstoque.id))
      .limit(100),
    searchParams,
  ]);
  const valorEmEstoque = opcoes.reduce((s, o) => s + Math.max(0, o.estoque) * o.custoCentavos, 0);

  return (
    <>
      <Cabecalho titulo="Estoque" />
      <Aviso ok={sp.ok} erro={sp.erro} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Cartao titulo={`Estoque baixo (até ${loja.estoqueMinimo} un.)`}>
            {baixo.length === 0 ? (
              <Vazio>Nenhum produto com estoque baixo.</Vazio>
            ) : (
              <ul className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {baixo.map((v) => (
                  <li key={v.varianteId} className="flex justify-between gap-2">
                    <Link href={`/admin/produtos/${v.produtoId}`} className="truncate hover:underline">
                      {v.produto}
                      {v.variante !== "Padrão" && <span className="text-stone-500"> · {v.variante}</span>}
                    </Link>
                    <span className={`tabular-nums ${v.estoque <= 0 ? "font-semibold text-red-600" : "text-amber-700"}`}>{v.estoque}</span>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
          <Cartao titulo="Últimas movimentações">
            {movimentos.length === 0 ? (
              <Vazio>Sem movimentações.</Vazio>
            ) : (
              <Tabela>
                <thead>
                  <tr><th>Quando</th><th>Produto</th><th>Tipo</th><th className="text-right">Qtd.</th><th>Nota</th></tr>
                </thead>
                <tbody>
                  {movimentos.map(({ m, produto, variante, produtoId }) => (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap text-stone-500">{formatarDataHora(m.criadoEm)}</td>
                      <td>
                        <Link href={`/admin/produtos/${produtoId}`} className="hover:underline">{produto}</Link>
                        {variante !== "Padrão" && <span className="text-stone-500"> · {variante}</span>}
                      </td>
                      <td>{TIPOS[m.tipo] ?? m.tipo}</td>
                      <td className={`text-right tabular-nums ${m.quantidade < 0 ? "text-red-600" : "text-green-700"}`}>{m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}</td>
                      <td className="text-stone-500">
                        {m.pedidoId ? <Link href={`/admin/pedidos/${m.pedidoId}`} className="underline">{m.nota}</Link> : m.compraId ? <Link href={`/admin/compras/${m.compraId}`} className="underline">{m.nota}</Link> : m.nota}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
            )}
          </Cartao>
        </div>
        <div className="space-y-6">
          <Cartao titulo="Ajustar estoque">
            <AjusteEstoque opcoes={opcoes} acao={acaoAjustar} />
          </Cartao>
          <Cartao titulo="Valor em estoque">
            <p className="text-2xl font-semibold tabular-nums">{(valorEmEstoque / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
            <p className="mt-1 text-xs text-stone-500">Pelo custo cadastrado de cada produto.</p>
          </Cartao>
        </div>
      </div>
    </>
  );
}
