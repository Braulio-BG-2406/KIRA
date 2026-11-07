import { lerDominios } from "@/lib/dominios";

// cada domínio de loja aponta para o próprio sitemap
export function GET(req: Request) {
  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const slug = lerDominios().get(host);
  const linhas = ["User-agent: *", "Disallow: /admin", "Disallow: /api", "Disallow: /checkout", "Disallow: /carrinho"];
  if (slug) linhas.push(`Sitemap: https://${host}/sitemap.xml`);
  return new Response(linhas.join("\n") + "\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
