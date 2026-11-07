import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clientes, pedidos } from "@/db/schema";
import { contexto, executar, inteiro, textoOuNulo } from "@/lib/painel";
import { formatarReais } from "@/lib/dinheiro";
import { formatarDataHora } from "@/lib/datas";
import { linkWhatsapp, soDigitos } from "@/lib/texto";
import { NOMES_STATUS } from "@/lib/rotulos";
import { ErroNegocio } from "@/lib/erros";
import { Aviso, Cabecalho, Cartao, Etiqueta, Vazio } from "@/components/admin/ui";
import { Enviar } from "@/components/admin/Botoes";

async function acaoSalvarCliente(fd: FormData) {
  "use server";
  const { loja } = await contexto();
  const id = inteiro(fd, "id");
  await executar(`/admin/clientes/${id}`, async () => {
    const nome = textoOuNulo(fd, "nome");
    if (!nome) throw new ErroNegocio("Informe o nome.");
    await db
      .update(clientes)
      .set({
        nome,
        email: textoOuNulo(fd, "email")?.toLowerCase() ?? null,
        telefone: soDigitos(textoOuNulo(fd, "telefone")) || null,
        documento: soDigitos(textoOuNulo(fd, "documento")) || null,
        observacoes: textoOuNulo(fd, "observacoes"),
      })
      .where(and(eq(clientes.id, id), eq(clientes.lojaId, loja.id)));
  });
}

export default async function Cliente({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { loja } = await contexto();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [c] = await db.select().from(clientes).where(and(eq(clientes.id, id), eq(clientes.lojaId, loja.id)));
  if (!c) notFound();
  const lista = await db.select().from(pedidos).where(eq(pedidos.clienteId, id)).orderBy(desc(pedidos.criadoEm));
  const validos = lista.filter((p) => p.status !== "cancelado");
  const total = validos.reduce((s, p) => s + p.totalCentavos, 0);
  const sp = await searchParams;
  return (
    <>
      <Cabecalho titulo={c.nome} voltar="/admin/clientes">
        {c.telefone && <a href={linkWhatsapp(c.telefone)} target="_blank" rel="noopener" className="botao-secundario">WhatsApp</a>}
      </Cabecalho>
      <Aviso ok={sp.ok} erro={sp.erro} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Cartao titulo={`Pedidos · ${validos.length} · ${formatarReais(total)}`}>
          {lista.length === 0 ? (
            <Vazio>Nenhum pedido.</Vazio>
          ) : (
            <ul className="divide-y divide-stone-100 text-sm">
              {lista.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/pedidos/${p.id}`} className="flex items-center gap-3 py-2 hover:bg-stone-50">
                    <span className="w-12 font-medium">#{p.numero}</span>
                    <span className="flex-1 text-stone-500">{formatarDataHora(p.criadoEm)}</span>
                    <Etiqueta valor={p.status} texto={NOMES_STATUS[p.status]} />
                    <span className="w-24 text-right tabular-nums">{formatarReais(p.totalCentavos)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        <Cartao titulo="Cadastro">
          <form action={acaoSalvarCliente} className="space-y-3">
            <input type="hidden" name="id" value={c.id} />
            <label className="block"><span className="rotulo">Nome</span><input name="nome" defaultValue={c.nome} className="campo" required /></label>
            <label className="block"><span className="rotulo">Telefone</span><input name="telefone" defaultValue={c.telefone ?? ""} className="campo" /></label>
            <label className="block"><span className="rotulo">E-mail</span><input name="email" type="email" defaultValue={c.email ?? ""} className="campo" /></label>
            <label className="block"><span className="rotulo">CPF/CNPJ</span><input name="documento" defaultValue={c.documento ?? ""} className="campo" /></label>
            {c.endereco && (
              <p className="text-xs text-stone-500">
                {c.endereco.logradouro}, {c.endereco.numero} · {c.endereco.bairro} · {c.endereco.cidade}/{c.endereco.uf} · {c.endereco.cep}
              </p>
            )}
            <label className="block"><span className="rotulo">Observações</span><textarea name="observacoes" rows={3} defaultValue={c.observacoes ?? ""} className="campo" /></label>
            <Enviar>Salvar</Enviar>
          </form>
        </Cartao>
      </div>
    </>
  );
}
