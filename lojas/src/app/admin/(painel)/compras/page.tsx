import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { compras, fornecedores } from "@/db/schema";
import { contexto } from "@/lib/painel";
import { formatarReais } from "@/lib/dinheiro";
import { formatarData } from "@/lib/datas";
import { Aviso, Cabecalho, Cartao, Etiqueta, Tabela, Vazio } from "@/components/admin/ui";

const NOMES = { rascunho: "Aguardando chegada", recebida: "Recebida", cancelada: "Cancelada" };

export default async function Compras({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { loja } = await contexto();
  const [lista, sp] = await Promise.all([
    db
      .select({ c: compras, fornecedor: fornecedores.nome })
      .from(compras)
      .leftJoin(fornecedores, eq(fornecedores.id, compras.fornecedorId))
      .where(eq(compras.lojaId, loja.id))
      .orderBy(desc(compras.criadoEm))
      .limit(200),
    searchParams,
  ]);
  return (
    <>
      <Cabecalho titulo="Compras de mercadoria">
        <Link href="/admin/compras/nova" className="botao-primario">Nova compra</Link>
      </Cabecalho>
      <Aviso ok={sp.ok} erro={sp.erro} />
      <Cartao>
        {lista.length === 0 ? (
          <Vazio>Registre aqui o que você compra para revender: o estoque e o custo dos produtos se atualizam sozinhos.</Vazio>
        ) : (
          <Tabela>
            <thead>
              <tr><th>#</th><th>Data</th><th>Fornecedor</th><th>Situação</th><th>Vencimento</th><th className="text-right">Total</th></tr>
            </thead>
            <tbody>
              {lista.map(({ c, fornecedor }) => (
                <tr key={c.id} className="hover:bg-stone-50">
                  <td><Link href={`/admin/compras/${c.id}`} className="font-medium hover:underline">#{c.id}</Link></td>
                  <td className="text-stone-500">{formatarData(c.criadoEm)}</td>
                  <td>{fornecedor ?? "—"}</td>
                  <td><Etiqueta valor={c.status} texto={NOMES[c.status]} /></td>
                  <td className="text-stone-500">{formatarData(c.vencimento)}</td>
                  <td className="text-right tabular-nums">{formatarReais(c.totalCentavos)}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Cartao>
    </>
  );
}
