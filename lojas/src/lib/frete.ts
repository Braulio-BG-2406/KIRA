import type { ConfigFrete } from "@/db/schema";

export type OpcaoFrete = {
  metodo: "retirada" | "entrega";
  descricao: string;
  valorCentavos: number;
  prazo: string;
};

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export function opcoesDeFrete(config: ConfigFrete, uf: string | null, subtotalCentavos: number): OpcaoFrete[] {
  const opcoes: OpcaoFrete[] = [];
  if (config.entrega.ativo && uf && UFS.includes(uf.toUpperCase())) {
    const e = config.entrega;
    const gratis = e.gratisAcimaCentavos != null && subtotalCentavos >= e.gratisAcimaCentavos;
    const valor = gratis ? 0 : (e.porUF[uf.toUpperCase()] ?? e.valorPadraoCentavos);
    opcoes.push({ metodo: "entrega", descricao: gratis ? "Entrega (frete grátis)" : "Entrega", valorCentavos: valor, prazo: e.prazo });
  }
  if (config.retirada.ativo) {
    opcoes.push({
      metodo: "retirada",
      descricao: "Retirar pessoalmente",
      valorCentavos: 0,
      prazo: config.retirada.endereco || "combinar pelo WhatsApp",
    });
  }
  return opcoes;
}
