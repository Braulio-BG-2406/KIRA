import { cookies } from "next/headers";
import { db } from "@/db";
import { canais, type Marketplace } from "@/db/schema";
import { usuarioAtual } from "@/lib/auth";
import { urlPublica } from "@/lib/mercadopago";
import { CONECTORES } from "@/lib/canais/sincronizar";

// o marketplace volta para cá com o código da autorização
export async function GET(req: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  const voltar = (tipoAviso: "ok" | "erro", msg: string) =>
    Response.redirect(`${urlPublica()}/admin/canais/${tipo}?${tipoAviso}=${encodeURIComponent(msg)}`, 303);
  if (!(await usuarioAtual())) return Response.redirect(`${urlPublica()}/admin/login`, 303);
  const jar = await cookies();
  const salvo = jar.get("oauth_canal")?.value;
  jar.delete({ name: "oauth_canal", path: "/api/canais" });
  const url = new URL(req.url);
  let pedido: { estado: string; lojaId: number; tipo: string };
  try {
    pedido = JSON.parse(salvo ?? "");
  } catch {
    return voltar("erro", "A autorização expirou. Clique em Conectar de novo.");
  }
  const estado = url.searchParams.get("state") ?? url.searchParams.get("estado");
  if (pedido.tipo !== tipo || !estado || estado !== pedido.estado) return voltar("erro", "Autorização não confere. Clique em Conectar de novo.");
  const codigo = url.searchParams.get("code");
  if (!codigo || !(tipo in CONECTORES)) return voltar("erro", "O marketplace não devolveu a autorização.");
  try {
    const credenciais = await CONECTORES[tipo as Marketplace].trocarCodigo(codigo, {
      redirect: `${urlPublica()}/api/canais/${tipo}/retorno`,
      shop_id: url.searchParams.get("shop_id") ?? "",
    });
    await db
      .insert(canais)
      .values({ lojaId: pedido.lojaId, tipo: tipo as Marketplace, credenciais })
      .onConflictDoUpdate({ target: [canais.lojaId, canais.tipo], set: { credenciais, ativo: true, ultimoErro: null } });
  } catch (e) {
    return voltar("erro", e instanceof Error ? e.message : "Falha ao conectar.");
  }
  return voltar("ok", "Conta conectada.");
}
