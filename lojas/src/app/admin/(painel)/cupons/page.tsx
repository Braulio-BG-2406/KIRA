import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cupons } from "@/db/schema";
import { centavos, contexto, executar, inteiro, texto } from "@/lib/painel";
import { formatarReais } from "@/lib/dinheiro";
import { formatarData } from "@/lib/datas";
import { ErroNegocio } from "@/lib/erros";
import { Aviso, Cabecalho, Cartao, Tabela, Vazio } from "@/components/admin/ui";
import { Confirmar, Enviar } from "@/components/admin/Botoes";

async function acaoNovoCupom(fd: FormData) {
  "use server";
  const { loja } = await contexto();
  await executar("/admin/cupons", async () => {
    const codigo = texto(fd, "codigo").toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (!codigo) throw new ErroNegocio("Informe o código (letras e números).");
    const tipo = texto(fd, "tipo") === "fixo" ? "fixo" : "percentual";
    const valor = tipo === "fixo" ? (centavos(fd, "valor") ?? 0) : inteiro(fd, "valor");
    if (valor <= 0 || (tipo === "percentual" && valor > 100)) throw new ErroNegocio("Valor do desconto inválido.");
    const validoAte = texto(fd, "validoAte");
    await db.insert(cupons).values({
      lojaId: loja.id,
      codigo,
      tipo,
      valor,
      minimoCentavos: centavos(fd, "minimo") ?? 0,
      validoAte: /^\d{4}-\d{2}-\d{2}$/.test(validoAte) ? validoAte : null,
      limiteUsos: inteiro(fd, "limite") || null,
    });
  }, "Cupom criado.");
}

async function acaoAlternarCupom(fd: FormData) {
  "use server";
  const { loja } = await contexto();
  await executar("/admin/cupons", async () => {
    await db.update(cupons).set({ ativo: texto(fd, "ativo") === "1" }).where(and(eq(cupons.id, inteiro(fd, "id")), eq(cupons.lojaId, loja.id)));
  });
}

async function acaoExcluirCupom(fd: FormData) {
  "use server";
  const { loja } = await contexto();
  await executar("/admin/cupons", async () => {
    await db.delete(cupons).where(and(eq(cupons.id, inteiro(fd, "id")), eq(cupons.lojaId, loja.id)));
  }, "Cupom excluído.");
}

export default async function Cupons({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { loja } = await contexto();
  const [lista, sp] = await Promise.all([db.select().from(cupons).where(eq(cupons.lojaId, loja.id)).orderBy(desc(cupons.criadoEm)), searchParams]);
  return (
    <>
      <Cabecalho titulo="Cupons de desconto" />
      <Aviso ok={sp.ok} erro={sp.erro} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Cartao>
          {lista.length === 0 ? (
            <Vazio>Nenhum cupom.</Vazio>
          ) : (
            <Tabela>
              <thead>
                <tr><th>Código</th><th>Desconto</th><th>Mínimo</th><th>Validade</th><th>Usos</th><th></th></tr>
              </thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={c.id} className={c.ativo ? "" : "opacity-50"}>
                    <td className="font-mono font-medium">{c.codigo}</td>
                    <td>{c.tipo === "percentual" ? `${c.valor}%` : formatarReais(c.valor)}</td>
                    <td>{c.minimoCentavos ? formatarReais(c.minimoCentavos) : "—"}</td>
                    <td>{formatarData(c.validoAte)}</td>
                    <td className="tabular-nums">{c.usos}{c.limiteUsos != null && ` / ${c.limiteUsos}`}</td>
                    <td className="whitespace-nowrap text-right">
                      <form action={acaoAlternarCupom} className="inline">
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="ativo" value={c.ativo ? "0" : "1"} />
                        <button className="text-xs underline">{c.ativo ? "pausar" : "ativar"}</button>
                      </form>
                      <form action={acaoExcluirCupom} className="ml-3 inline">
                        <input type="hidden" name="id" value={c.id} />
                        <Confirmar pergunta={`Excluir o cupom ${c.codigo}?`} className="text-xs text-red-600 underline">excluir</Confirmar>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )}
        </Cartao>
        <Cartao titulo="Novo cupom">
          <form action={acaoNovoCupom} className="space-y-3">
            <input name="codigo" placeholder="Código (ex.: BEMVINDO10)" className="campo uppercase" required />
            <div className="grid grid-cols-2 gap-2">
              <select name="tipo" className="campo"><option value="percentual">% do valor</option><option value="fixo">R$ fixo</option></select>
              <input name="valor" placeholder="Valor" inputMode="decimal" className="campo" required />
            </div>
            <input name="minimo" placeholder="Compra mínima (R$, opcional)" inputMode="decimal" className="campo" />
            <div className="grid grid-cols-2 gap-2">
              <label><span className="rotulo">Válido até</span><input name="validoAte" type="date" className="campo" /></label>
              <label><span className="rotulo">Limite de usos</span><input name="limite" type="number" min={1} className="campo" /></label>
            </div>
            <Enviar className="botao-primario w-full">Criar cupom</Enviar>
          </form>
        </Cartao>
      </div>
    </>
  );
}
