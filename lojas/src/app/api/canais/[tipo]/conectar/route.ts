import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { usuarioAtual } from "@/lib/auth";
import { lojaDoPainel } from "@/lib/lojas";
import { urlPublica } from "@/lib/mercadopago";
import { mlConfigurado, mlLinkAutorizacao } from "@/lib/canais/mercadolivre";
import { shopeeConfigurado, shopeeLinkAutorizacao } from "@/lib/canais/shopee";

// botão "Conectar" do painel: manda para a tela de autorização do marketplace
export async function GET(_req: Request, { params }: { params: Promise<{ tipo: string }> }) {
  if (!(await usuarioAtual())) return Response.redirect(`${urlPublica()}/admin/login`, 303);
  const { tipo } = await params;
  const loja = await lojaDoPainel();
  const estado = randomBytes(16).toString("hex");
  const retorno = `${urlPublica()}/api/canais/${tipo}/retorno`;
  let destino: string;
  if (tipo === "mercadolivre" && mlConfigurado()) destino = mlLinkAutorizacao(retorno, estado);
  else if (tipo === "shopee" && shopeeConfigurado()) destino = shopeeLinkAutorizacao(`${retorno}?estado=${estado}`);
  else return Response.redirect(`${urlPublica()}/admin/canais/${tipo}?erro=${encodeURIComponent("Falta configurar as chaves deste canal no servidor.")}`, 303);
  (await cookies()).set("oauth_canal", JSON.stringify({ estado, lojaId: loja.id, tipo }), {
    httpOnly: true,
    sameSite: "lax",
    secure: urlPublica().startsWith("https"),
    path: "/api/canais",
    maxAge: 600,
  });
  return Response.redirect(destino, 303);
}
