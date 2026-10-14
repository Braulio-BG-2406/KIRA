import type { Cupom } from "@/db/schema";
import { hojeSP } from "./datas";

export type ResultadoCupom = { ok: true; descontoCentavos: number } | { ok: false; erro: string };

export function aplicarCupom(cupom: Cupom | null | undefined, subtotalCentavos: number, agora = new Date()): ResultadoCupom {
  if (!cupom || !cupom.ativo) return { ok: false, erro: "Cupom inválido." };
  if (cupom.validoAte && cupom.validoAte < hojeSP(agora)) return { ok: false, erro: "Este cupom já venceu." };
  if (cupom.limiteUsos != null && cupom.usos >= cupom.limiteUsos) return { ok: false, erro: "Este cupom já foi todo usado." };
  if (subtotalCentavos < cupom.minimoCentavos) {
    const minimo = (cupom.minimoCentavos / 100).toFixed(2).replace(".", ",");
    return { ok: false, erro: `Este cupom vale para compras a partir de R$ ${minimo}.` };
  }
  const bruto = cupom.tipo === "percentual" ? Math.round((subtotalCentavos * cupom.valor) / 100) : cupom.valor;
  return { ok: true, descontoCentavos: Math.min(bruto, subtotalCentavos) };
}
