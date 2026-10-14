import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { fornecedores } from "@/db/schema";
import { contexto } from "@/lib/painel";
import { opcoesDeVariantes } from "@/lib/opcoes";
import { Aviso, Cabecalho } from "@/components/admin/ui";
import { CompraForm } from "@/components/admin/CompraForm";
import { acaoNovaCompra } from "../acoes";

export default async function NovaCompra({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { loja } = await contexto();
  const [opcoes, forn, sp] = await Promise.all([
    opcoesDeVariantes(loja.id, true),
    db.select({ id: fornecedores.id, nome: fornecedores.nome }).from(fornecedores).where(eq(fornecedores.lojaId, loja.id)).orderBy(asc(fornecedores.nome)),
    searchParams,
  ]);
  return (
    <>
      <Cabecalho titulo="Nova compra" voltar="/admin/compras" />
      <Aviso ok={sp.ok} erro={sp.erro} />
      <CompraForm opcoes={opcoes} fornecedores={forn} acao={acaoNovaCompra} />
    </>
  );
}
