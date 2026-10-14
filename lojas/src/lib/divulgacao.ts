import type { Loja } from "@/db/schema";
import type { ProdutoVitrine } from "./catalogo";
import { formatarReais } from "./dinheiro";
import { parcela, precoNoPix } from "./precos";
import { criarSlug } from "./texto";

/** legenda pronta para Instagram (e WhatsApp), no tom de loja */
export function legendaInstagram(loja: Pick<Loja, "nome" | "descontoPixPct" | "parcelasSemJuros" | "whatsapp">, p: ProdutoVitrine, link: string, categoria?: string | null): string {
  const primeiraFrase = p.descricao.split(/(?<=[.!?])\s/)[0]?.trim();
  const parc = parcela(p.precoMin, loja.parcelasSemJuros);
  const linhas = [
    `${p.nome}${p.marca ? ` · ${p.marca}` : ""}`,
    "",
    ...(primeiraFrase ? [primeiraFrase, ""] : []),
    `💰 ${p.precoMax !== p.precoMin ? "a partir de " : ""}${formatarReais(p.precoMin)}${p.precoDe ? ` (de ${formatarReais(p.precoDe)})` : ""}`,
    ...(loja.descontoPixPct > 0 ? [`⚡ ${formatarReais(precoNoPix(p.precoMin, loja.descontoPixPct))} no Pix`] : []),
    ...(parc ? [`💳 ou ${parc.vezes}x de ${formatarReais(parc.valor)} sem juros`] : []),
    ...(p.garantia ? [`✅ Garantia: ${p.garantia}`] : []),
    "🚚 Enviamos para todo o Brasil",
    "",
    `🛒 Compre aqui: ${link}`,
    ...(loja.whatsapp ? ["💬 Ou chame a gente no WhatsApp"] : []),
    "",
    hashtags(loja.nome, p, categoria),
  ];
  return linhas.join("\n");
}

function hashtags(nomeLoja: string, p: ProdutoVitrine, categoria?: string | null): string {
  const tags = new Set<string>();
  const tag = (s: string) => {
    const t = criarSlug(s).replace(/-/g, "");
    if (t.length >= 3 && t.length <= 30) tags.add(`#${t}`);
  };
  tag(nomeLoja);
  if (categoria) tag(categoria);
  if (p.marca) tag(p.marca);
  // palavras fortes do nome do produto
  for (const palavra of p.nome.split(/\s+/).slice(0, 3)) if (palavra.length > 3) tag(palavra);
  return [...tags].slice(0, 8).join(" ");
}
