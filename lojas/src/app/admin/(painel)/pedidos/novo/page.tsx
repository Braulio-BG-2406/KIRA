import { contexto } from "@/lib/painel";
import { opcoesDeVariantes } from "@/lib/opcoes";
import { Aviso, Cabecalho } from "@/components/admin/ui";
import { VendaForm } from "@/components/admin/VendaForm";
import { acaoNovaVenda } from "../acoes";

export default async function NovaVenda({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { loja } = await contexto();
  const sp = await searchParams;
  return (
    <>
      <Cabecalho titulo="Nova venda" />
      <p className="-mt-4 mb-5 text-sm text-stone-500">Para vendas do WhatsApp, Instagram ou balcão. O estoque baixa na hora.</p>
      <Aviso ok={sp.ok} erro={sp.erro} />
      <VendaForm opcoes={await opcoesDeVariantes(loja.id)} acao={acaoNovaVenda} />
    </>
  );
}
