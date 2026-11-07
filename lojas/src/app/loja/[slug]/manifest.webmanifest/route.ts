import { buscarLoja, baseDaLoja } from "@/lib/lojas";
import { visualDaLoja } from "@/lib/visual";

/** manifesto do app: com ele o celular oferece "Instalar app" / "Adicionar à tela de início" */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loja = await buscarLoja(slug);
  const app = visualDaLoja(slug).app;
  if (!loja || !app) return new Response("Não encontrado", { status: 404 });
  const inicio = `${await baseDaLoja(slug)}/`;
  const manifesto = {
    id: inicio,
    name: loja.nome,
    short_name: app.nomeCurto,
    description: app.descricao,
    lang: "pt-BR",
    start_url: inicio,
    scope: inicio,
    display: "standalone",
    background_color: app.cor,
    theme_color: app.cor,
    icons: [
      { src: app.icone192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: app.icone512, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: app.mascaravel, sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: app.apple, sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
  return new Response(JSON.stringify(manifesto), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } });
}
