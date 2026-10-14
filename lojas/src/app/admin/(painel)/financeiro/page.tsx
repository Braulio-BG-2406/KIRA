import Link from "next/link";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { lancamentos, type TipoLancamento } from "@/db/schema";
import { centavos, contexto, executar, inteiro, marcado, texto } from "@/lib/painel";
import { cancelarLancamento, criarLancamento, quitarLancamento, resumoDoMes } from "@/lib/financeiro";
import { formatarReais } from "@/lib/dinheiro";
import { formatarData, hojeSP } from "@/lib/datas";
import { Aviso, Cabecalho, Cartao, Etiqueta, Indicador, Tabela, Vazio } from "@/components/admin/ui";
import { Confirmar, Enviar } from "@/components/admin/Botoes";

const CATEGORIAS = {
  receita: ["Vendas", "Outras receitas"],
  despesa: ["Compra de mercadoria", "Embalagens", "Frete e correios", "Marketing e anúncios", "Taxas e tarifas", "Aluguel", "Contas (luz, água, internet)", "Salários e comissões", "Impostos", "Sistemas e assinaturas", "Outras despesas"],
};

function mesValido(m: string | undefined) {
  return m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : hojeSP().slice(0, 7);
}

function deslocar(mes: string, n: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function acaoNovoLancamento(fd: FormData) {
  "use server";
  const { loja } = await contexto();
  const mes = texto(fd, "mes");
  await executar(`/admin/financeiro?mes=${mes}`, async () => {
    await criarLancamento({
      lojaId: loja.id,
      tipo: texto(fd, "tipo") === "receita" ? "receita" : "despesa",
      categoria: texto(fd, "categoria"),
      descricao: texto(fd, "descricao"),
      valorCentavos: centavos(fd, "valor") ?? 0,
      vencimento: texto(fd, "vencimento"),
      pago: marcado(fd, "pago"),
    });
  }, "Lançamento registrado.");
}

async function acaoQuitar(fd: FormData) {
  "use server";
  const { loja } = await contexto();
  await executar(`/admin/financeiro?mes=${texto(fd, "mes")}`, () => quitarLancamento(inteiro(fd, "id"), loja.id), "Marcado como pago.");
}

async function acaoCancelarLancamento(fd: FormData) {
  "use server";
  const { loja } = await contexto();
  await executar(`/admin/financeiro?mes=${texto(fd, "mes")}`, () => cancelarLancamento(inteiro(fd, "id"), loja.id), "Lançamento cancelado.");
}

export default async function Financeiro({ searchParams }: { searchParams: Promise<{ mes?: string; tipo?: string; ok?: string; erro?: string }> }) {
  const { loja } = await contexto();
  const sp = await searchParams;
  const mes = mesValido(sp.mes);
  const tipo: TipoLancamento | null = sp.tipo === "receita" || sp.tipo === "despesa" ? sp.tipo : null;
  const filtros = [eq(lancamentos.lojaId, loja.id), gte(lancamentos.vencimento, `${mes}-01`), lt(lancamentos.vencimento, `${deslocar(mes, 1)}-01`)];
  if (tipo) filtros.push(eq(lancamentos.tipo, tipo));
  const [lista, r] = await Promise.all([
    db.select().from(lancamentos).where(and(...filtros)).orderBy(asc(lancamentos.vencimento), asc(lancamentos.id)),
    resumoDoMes(loja.id, mes),
  ]);
  const nomeMes = new Date(`${mes}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  const hoje = hojeSP();

  return (
    <>
      <Cabecalho titulo="Financeiro">
        <Link href={`/admin/financeiro?mes=${deslocar(mes, -1)}`} className="botao-secundario" aria-label="Mês anterior">←</Link>
        <span className="self-center text-sm font-medium capitalize">{nomeMes}</span>
        <Link href={`/admin/financeiro?mes=${deslocar(mes, 1)}`} className="botao-secundario" aria-label="Próximo mês">→</Link>
      </Cabecalho>
      <Aviso ok={sp.ok} erro={sp.erro} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Indicador rotulo="Recebido" valor={formatarReais(r.recebido)} />
        <Indicador rotulo="A receber" valor={formatarReais(r.aReceber)} />
        <Indicador rotulo="Pago" valor={formatarReais(r.pago)} />
        <Indicador rotulo="A pagar" valor={formatarReais(r.aPagar)} />
        <Indicador rotulo="Saldo do mês" valor={formatarReais(r.saldo)} detalhe="recebido − pago" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Cartao>
          <div className="mb-3 flex gap-2 text-sm">
            {[["", "Tudo"], ["receita", "Receitas"], ["despesa", "Despesas"]].map(([t, n]) => (
              <Link key={t} href={`/admin/financeiro?mes=${mes}${t ? `&tipo=${t}` : ""}`} className={`rounded-full px-3 py-1 ${(tipo ?? "") === t ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600"}`}>
                {n}
              </Link>
            ))}
          </div>
          {lista.length === 0 ? (
            <Vazio>Nenhum lançamento neste mês.</Vazio>
          ) : (
            <Tabela>
              <thead>
                <tr><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th>Situação</th><th className="text-right">Valor</th><th></th></tr>
              </thead>
              <tbody>
                {lista.map((l) => {
                  const atrasado = l.status === "pendente" && l.vencimento < hoje;
                  return (
                    <tr key={l.id} className={l.status === "cancelado" ? "opacity-50" : ""}>
                      <td className={`whitespace-nowrap ${atrasado ? "font-medium text-red-600" : "text-stone-500"}`}>{formatarData(l.vencimento)}</td>
                      <td>
                        {l.pedidoId ? <Link href={`/admin/pedidos/${l.pedidoId}`} className="hover:underline">{l.descricao}</Link> : l.compraId ? <Link href={`/admin/compras/${l.compraId}`} className="hover:underline">{l.descricao}</Link> : l.descricao}
                      </td>
                      <td className="text-stone-500">{l.categoria}</td>
                      <td><Etiqueta valor={l.status} texto={atrasado ? "atrasado" : l.status} /></td>
                      <td className={`text-right tabular-nums ${l.tipo === "despesa" ? "text-red-700" : "text-green-700"}`}>
                        {l.tipo === "despesa" ? "− " : ""}{formatarReais(l.valorCentavos)}
                      </td>
                      <td className="whitespace-nowrap text-right">
                        {l.status === "pendente" && (
                          <form action={acaoQuitar} className="inline">
                            <input type="hidden" name="id" value={l.id} />
                            <input type="hidden" name="mes" value={mes} />
                            <button className="text-xs underline">{l.tipo === "despesa" ? "paguei" : "recebi"}</button>
                          </form>
                        )}
                        {l.status !== "cancelado" && !l.pedidoId && (
                          <form action={acaoCancelarLancamento} className="ml-3 inline">
                            <input type="hidden" name="id" value={l.id} />
                            <input type="hidden" name="mes" value={mes} />
                            <Confirmar pergunta="Cancelar este lançamento?" className="text-xs text-red-600 underline">cancelar</Confirmar>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Tabela>
          )}
          <p className="mt-3 text-xs text-stone-500">Vendas pagas entram aqui sozinhas. Compras de mercadoria recebidas viram contas a pagar.</p>
        </Cartao>
        <Cartao titulo="Novo lançamento">
          <form action={acaoNovoLancamento} className="space-y-3">
            <input type="hidden" name="mes" value={mes} />
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name="tipo" value="despesa" defaultChecked /> Despesa</label>
              <label className="flex items-center gap-2"><input type="radio" name="tipo" value="receita" /> Receita</label>
            </div>
            <input name="descricao" placeholder="Descrição" className="campo" required />
            <input name="categoria" list="categorias-fin" placeholder="Categoria" className="campo" />
            <datalist id="categorias-fin">
              {[...CATEGORIAS.despesa, ...CATEGORIAS.receita].map((c) => <option key={c} value={c} />)}
            </datalist>
            <div className="grid grid-cols-2 gap-2">
              <input name="valor" placeholder="Valor (R$)" inputMode="decimal" className="campo" required />
              <input name="vencimento" type="date" defaultValue={hoje} className="campo" required />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="pago" defaultChecked /> Já foi pago/recebido</label>
            <Enviar className="botao-primario w-full">Lançar</Enviar>
          </form>
        </Cartao>
      </div>
    </>
  );
}
