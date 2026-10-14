import { contexto } from "@/lib/painel";
import { categoriasDaLoja } from "@/lib/catalogo";
import { Aviso, Cabecalho } from "@/components/admin/ui";
import { ProdutoForm } from "@/components/admin/ProdutoForm";
import { acaoSalvarProduto } from "../acoes";

export default async function NovoProduto({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { loja } = await contexto();
  const sp = await searchParams;
  return (
    <>
      <Cabecalho titulo="Novo produto" voltar="/admin/produtos" />
      <Aviso ok={sp.ok} erro={sp.erro} />
      <ProdutoForm acao={acaoSalvarProduto} categorias={await categoriasDaLoja(loja.id)} variantes={[]} />
      <p className="mt-4 text-sm text-stone-500">As fotos entram depois de salvar.</p>
    </>
  );
}
