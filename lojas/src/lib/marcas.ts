import { semAcentos } from "./texto";

// Nomes de marcas e modelos de terceiros (e termos de réplica) que não podem aparecer
// em produto de coleção própria: os marketplaces, o Google e a Meta derrubam o anúncio
// e podem suspender a conta. A lista é curta de propósito; amplie conforme precisar.
const TERMOS = [
  "rolex", "omega", "tag heuer", "heuer", "citizen", "casio", "g-shock", "seiko", "tissot", "patek", "philippe",
  "audemars", "piguet", "hublot", "cartier", "breitling", "iwc", "tudor", "longines", "bulgari", "bvlgari", "panerai",
  "richard mille", "vacheron", "jaeger", "oris", "michael kors", "armani", "fossil", "invicta", "technos", "orient",
  "swatch", "tiffany", "snoopy", "formula 1", "formula one", "f1", "speedmaster", "moonwatch", "seamaster", "submariner",
  "daytona", "datejust", "land-dweller", "land dweller", "gmt-master", "yacht-master", "nautilus", "aquanaut", "royal oak",
  "carrera", "monaco", "aquaracer", "santos", "navitimer", "superocean",
  // acessórios: cinto, carteira e óculos
  "gucci", "louis vuitton", "hermes", "prada", "versace", "gabbana", "ferragamo", "montblanc", "lacoste", "hugo boss",
  "calvin klein", "tommy hilfiger", "diesel", "ray-ban", "rayban", "ray ban", "oakley",
  "replica", "first line", "primeira linha",
];

// "corrente cartier", "colar ômega" etc. são nomes de modelo de corrente na joalheria, não marca
const CORRENTES = /(^|[^a-z0-9])((corrente|correntes|fio|elo|elos|colar|choker|gargantilha|pulseira|tornozeleira)\s+(de\s+)?(elo\s+)?)(cartier|omega|gucci)(?=[^a-z0-9]|$)/g;

const normalizar = (t: string) => semAcentos(t).toLowerCase();

/** marcas de terceiros citadas nos textos (sem repetir), na grafia da lista */
export function marcasDeTerceiros(...textos: (string | null | undefined)[]): string[] {
  const alvo = ` ${normalizar(textos.filter(Boolean).join(" \n ")).replace(CORRENTES, "$1$2")} `;
  return TERMOS.filter((termo) => {
    const t = normalizar(termo).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${t}([^a-z0-9]|$)`).test(alvo);
  });
}

/** junta tudo o que aparece do produto para o cliente e para os marketplaces */
export function textosDoProduto(p: {
  nome: string;
  descricao?: string | null;
  marca?: string | null;
  especificacoes?: { nome: string; valor: string }[];
  variantes?: { nome: string }[];
}): string[] {
  return [
    p.nome,
    p.descricao,
    p.marca,
    ...(p.especificacoes ?? []).map((e) => `${e.nome} ${e.valor}`),
    ...(p.variantes ?? []).map((v) => v.nome),
  ].filter((t): t is string => !!t);
}
