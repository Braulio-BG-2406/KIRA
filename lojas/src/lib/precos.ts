/** preço com o desconto do Pix (mesma conta do pedido) */
export function precoNoPix(centavos: number, descontoPixPct: number): number {
  return descontoPixPct > 0 ? centavos - Math.round((centavos * descontoPixPct) / 100) : centavos;
}

/** valor de cada parcela sem juros, ou null quando a loja não parcela */
export function parcela(centavos: number, parcelas: number): { vezes: number; valor: number } | null {
  if (parcelas < 2) return null;
  // parcela mínima de R$ 20, como os meios de pagamento costumam exigir
  const vezes = Math.min(parcelas, Math.floor(centavos / 2000));
  if (vezes < 2) return null;
  return { vezes, valor: Math.ceil(centavos / vezes) };
}
