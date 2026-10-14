import { usuarioAtual } from "@/lib/auth";
import { lojaDoPainel } from "@/lib/lojas";
import { gerarCsv } from "@/lib/csv";
import { lerPeriodo, linhasEstoqueCsv, linhasItensCsv, linhasPedidosCsv } from "@/lib/relatorios";
import { formatarDataHora } from "@/lib/datas";
import { NOMES_CANAL, NOMES_PAGAMENTO, NOMES_STATUS } from "@/lib/rotulos";

const r = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));

export async function GET(req: Request) {
  if (!(await usuarioAtual())) return new Response("Faça login no painel.", { status: 401 });
  const loja = await lojaDoPainel();
  const url = new URL(req.url);
  const periodo = lerPeriodo(url.searchParams.get("de") ?? undefined, url.searchParams.get("ate") ?? undefined);
  const tipo = url.searchParams.get("tipo");
  let linhas: (string | number | null)[][];
  if (tipo === "itens") {
    const dados = await linhasItensCsv(loja.id, periodo);
    linhas = [
      ["pedido", "data", "status", "produto", "variacao", "sku", "quantidade", "preco_unit", "custo_unit", "total"],
      ...dados.map(({ i, numero, status, criadoEm }) => [numero, formatarDataHora(criadoEm), NOMES_STATUS[status], i.produtoNome, i.varianteNome, i.sku, i.quantidade, r(i.precoUnitCentavos), r(i.custoUnitCentavos), r(i.precoUnitCentavos * i.quantidade)]),
    ];
  } else if (tipo === "estoque") {
    const dados = await linhasEstoqueCsv(loja.id);
    // mesmo formato da importação: dá para editar no Excel e importar de volta
    linhas = [
      ["nome", "marca", "categoria", "variacao", "sku", "codigo_barras", "preco", "preco_de", "custo", "estoque", "descricao", "ativo"],
      ...dados.map(({ v, produto, marca, ativo }) => [produto, marca, "", v.nome, v.sku, v.codigoBarras, r(v.precoCentavos), r(v.precoDeCentavos), r(v.custoCentavos), v.estoque, "", ativo && v.ativo ? "sim" : "nao"]),
    ];
  } else {
    const dados = await linhasPedidosCsv(loja.id, periodo);
    linhas = [
      ["numero", "data", "cliente", "telefone", "email", "canal", "pagamento", "status", "status_pagamento", "subtotal", "desconto", "frete", "total", "cupom", "entrega", "rastreio"],
      ...dados.map(({ p, cliente, telefone, email }) => [
        p.numero, formatarDataHora(p.criadoEm), cliente, telefone, email, NOMES_CANAL[p.canal], NOMES_PAGAMENTO[p.formaPagamento], NOMES_STATUS[p.status], p.statusPagamento,
        r(p.subtotalCentavos), r(p.descontoCentavos), r(p.freteCentavos), r(p.totalCentavos), p.cupomCodigo, p.entrega.descricao, p.codigoRastreio,
      ]),
    ];
  }
  const nome = `${loja.slug}-${tipo ?? "pedidos"}-${tipo === "estoque" ? "atual" : `${periodo.de}_a_${periodo.ate}`}.csv`;
  return new Response(gerarCsv(linhas), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nome}"` },
  });
}
