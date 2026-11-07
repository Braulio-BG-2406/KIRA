import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { categorias } from "@/db/schema";
import { contexto, executar, inteiro, texto } from "@/lib/painel";
import { categoriasDaLoja } from "@/lib/catalogo";
import { criarSlug } from "@/lib/texto";
import { ErroNegocio } from "@/lib/erros";
import { Aviso, Cabecalho, Cartao, Vazio } from "@/components/admin/ui";
import { Confirmar, Enviar } from "@/components/admin/Botoes";

async function acaoSalvarCategoria(fd: FormData) {
  "use server";
  const { loja } = await contexto();
  await executar("/admin/categorias", async () => {
    const nome = texto(fd, "nome");
    if (!nome) throw new ErroNegocio("Informe o nome.");
    const id = inteiro(fd, "id");
    const dados = { nome, slug: criarSlug(nome), ordem: inteiro(fd, "ordem") };
    if (id) await db.update(categorias).set(dados).where(and(eq(categorias.id, id), eq(categorias.lojaId, loja.id)));
    else await db.insert(categorias).values({ ...dados, lojaId: loja.id });
  });
}

async function acaoExcluirCategoria(fd: FormData) {
  "use server";
  const { loja } = await contexto();
  await executar("/admin/categorias", async () => {
    await db.delete(categorias).where(and(eq(categorias.id, inteiro(fd, "id")), eq(categorias.lojaId, loja.id)));
  }, "Categoria excluída. Os produtos dela ficaram sem categoria.");
}

export default async function Categorias({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { loja } = await contexto();
  const [cats, sp] = await Promise.all([categoriasDaLoja(loja.id), searchParams]);
  return (
    <>
      <Cabecalho titulo="Categorias" />
      <Aviso ok={sp.ok} erro={sp.erro} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Cartao>
          {cats.length === 0 ? (
            <Vazio>Nenhuma categoria ainda.</Vazio>
          ) : (
            <ul className="divide-y divide-stone-100">
              {cats.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 py-2">
                  <form action={acaoSalvarCategoria} className="flex flex-1 flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <input name="nome" defaultValue={c.nome} className="campo min-w-40 flex-1" aria-label="Nome" />
                    <input name="ordem" type="number" defaultValue={c.ordem} className="campo w-20" aria-label="Ordem" title="Ordem no menu" />
                    <Enviar className="botao-secundario">Salvar</Enviar>
                  </form>
                  <form action={acaoExcluirCategoria}>
                    <input type="hidden" name="id" value={c.id} />
                    <Confirmar pergunta={`Excluir a categoria ${c.nome}?`} className="botao-perigo">Excluir</Confirmar>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        <Cartao titulo="Nova categoria">
          <form action={acaoSalvarCategoria} className="space-y-3">
            <input name="nome" placeholder="Ex.: Brincos" className="campo" required />
            <input name="ordem" type="number" placeholder="Ordem no menu" defaultValue={cats.length} className="campo" />
            <Enviar>Adicionar</Enviar>
          </form>
        </Cartao>
      </div>
    </>
  );
}
