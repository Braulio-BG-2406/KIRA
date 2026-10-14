"use server";

import { contexto, centavos, executar, inteiro, marcado, texto, textoOuNulo } from "@/lib/painel";
import { cancelarCompra, criarCompra, receberCompra } from "@/lib/compras";
import { ErroNegocio } from "@/lib/erros";

export async function acaoNovaCompra(fd: FormData) {
  const { loja } = await contexto();
  await executar("/admin/compras/nova", async () => {
    let itens;
    try {
      itens = JSON.parse(texto(fd, "itens"));
    } catch {
      throw new ErroNegocio("Itens inválidos.");
    }
    const vencimento = texto(fd, "vencimento");
    const compra = await criarCompra({
      lojaId: loja.id,
      fornecedorId: inteiro(fd, "fornecedorId") || null,
      itens: (itens as { varianteId: number; quantidade: number; custoUnitCentavos: number }[]).map((i) => ({
        varianteId: Number(i.varianteId),
        quantidade: Number(i.quantidade),
        custoUnitCentavos: Number(i.custoUnitCentavos),
      })),
      freteCentavos: centavos(fd, "frete") ?? 0,
      vencimento: /^\d{4}-\d{2}-\d{2}$/.test(vencimento) ? vencimento : null,
      observacoes: textoOuNulo(fd, "observacoes"),
    });
    if (marcado(fd, "receber")) await receberCompra(compra.id, loja.id);
    return `/admin/compras/${compra.id}`;
  }, "Compra salva.");
}

export async function acaoReceberCompra(fd: FormData) {
  const { loja } = await contexto();
  const id = inteiro(fd, "id");
  await executar(`/admin/compras/${id}`, () => receberCompra(id, loja.id), "Mercadoria recebida: estoque e custo atualizados, conta a pagar lançada.");
}

export async function acaoCancelarCompra(fd: FormData) {
  const { loja } = await contexto();
  const id = inteiro(fd, "id");
  await executar(`/admin/compras/${id}`, () => cancelarCompra(id, loja.id), "Compra cancelada.");
}
