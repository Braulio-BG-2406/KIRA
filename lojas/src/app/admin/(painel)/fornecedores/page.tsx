import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { fornecedores } from "@/db/schema";
import { contexto, executar, inteiro, texto, textoOuNulo } from "@/lib/painel";
import { ErroNegocio } from "@/lib/erros";
import { Aviso, Cabecalho, Cartao, Vazio } from "@/components/admin/ui";
import { Enviar } from "@/components/admin/Botoes";

async function acaoSalvarFornecedor(fd: FormData) {
  "use server";
  const { loja } = await contexto();
  await executar("/admin/fornecedores", async () => {
    const nome = texto(fd, "nome");
    if (!nome) throw new ErroNegocio("Informe o nome.");
    const dados = {
      nome,
      contato: textoOuNulo(fd, "contato"),
      telefone: textoOuNulo(fd, "telefone"),
      email: textoOuNulo(fd, "email"),
      documento: textoOuNulo(fd, "documento"),
      observacoes: textoOuNulo(fd, "observacoes"),
    };
    const id = inteiro(fd, "id");
    if (id) await db.update(fornecedores).set(dados).where(and(eq(fornecedores.id, id), eq(fornecedores.lojaId, loja.id)));
    else await db.insert(fornecedores).values({ ...dados, lojaId: loja.id });
  });
}

type F = typeof fornecedores.$inferSelect;

function Campos({ f }: { f?: F }) {
  return (
    <>
      {f && <input type="hidden" name="id" value={f.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2"><span className="rotulo">Nome</span><input name="nome" defaultValue={f?.nome} className="campo" required /></label>
        <label className="block"><span className="rotulo">Contato</span><input name="contato" defaultValue={f?.contato ?? ""} className="campo" /></label>
        <label className="block"><span className="rotulo">Telefone</span><input name="telefone" defaultValue={f?.telefone ?? ""} className="campo" /></label>
        <label className="block"><span className="rotulo">E-mail</span><input name="email" defaultValue={f?.email ?? ""} className="campo" /></label>
        <label className="block"><span className="rotulo">CNPJ/CPF</span><input name="documento" defaultValue={f?.documento ?? ""} className="campo" /></label>
        <label className="block sm:col-span-2"><span className="rotulo">Observações</span><textarea name="observacoes" rows={2} defaultValue={f?.observacoes ?? ""} className="campo" /></label>
      </div>
    </>
  );
}

export default async function Fornecedores({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { loja } = await contexto();
  const [lista, sp] = await Promise.all([db.select().from(fornecedores).where(eq(fornecedores.lojaId, loja.id)).orderBy(asc(fornecedores.nome)), searchParams]);
  return (
    <>
      <Cabecalho titulo="Fornecedores" />
      <Aviso ok={sp.ok} erro={sp.erro} />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Cartao>
          {lista.length === 0 ? (
            <Vazio>Nenhum fornecedor cadastrado.</Vazio>
          ) : (
            <ul className="divide-y divide-stone-100">
              {lista.map((f) => (
                <li key={f.id} className="py-2">
                  <details>
                    <summary className="cursor-pointer text-sm">
                      <span className="font-medium">{f.nome}</span>
                      <span className="ml-2 text-stone-500">{[f.contato, f.telefone, f.email].filter(Boolean).join(" · ")}</span>
                    </summary>
                    <form action={acaoSalvarFornecedor} className="mt-3 space-y-3 pb-2">
                      <Campos f={f} />
                      <Enviar className="botao-secundario">Salvar</Enviar>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        <Cartao titulo="Novo fornecedor">
          <form action={acaoSalvarFornecedor} className="space-y-3">
            <Campos />
            <Enviar>Adicionar</Enviar>
          </form>
        </Cartao>
      </div>
    </>
  );
}
