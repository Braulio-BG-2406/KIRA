/** LOJA_DOMINIOS="dominio.com.br=slug,www.dominio.com.br=slug" */
export function lerDominios(valor = process.env.LOJA_DOMINIOS ?? ""): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const par of valor.split(",")) {
    const [dominio, slug] = par.split("=").map((s) => s?.trim().toLowerCase());
    if (dominio && slug) mapa.set(dominio, slug);
  }
  return mapa;
}

/** endereço público da vitrine de uma loja (domínio próprio ou /loja/<slug>) */
export function urlDaLoja(slug: string): string {
  const dominio = [...lerDominios()].find(([, s]) => s === slug)?.[0];
  if (dominio) return `https://${dominio}`;
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/loja/${slug}`;
}
