const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatarReais(centavos: number): string {
  return brl.format(centavos / 100);
}

/** "1.234,56", "1234,56", "1234.56" ou "R$ 12" -> centavos. Devolve null se não for um valor. */
export function lerReais(texto: string | null | undefined): number | null {
  if (texto == null) return null;
  let s = String(texto).replace(/[R$\s]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}

/** centavos -> "1234,56" para preencher campos de formulário */
export function reaisParaCampo(centavos: number | null | undefined): string {
  if (centavos == null) return "";
  return (centavos / 100).toFixed(2).replace(".", ",");
}
