import { NextResponse, type NextRequest } from "next/server";
import { lerDominios } from "@/lib/dominios";

const dominios = lerDominios();
// caminhos que nunca são da vitrine
const SISTEMA = /^\/(admin|api|uploads|loja|_next)(\/|$)|^\/(favicon\.ico|robots\.txt)$/;

export function middleware(req: NextRequest) {
  // o cabeçalho é só nosso: descarta o que vier de fora
  const cabecalhos = new Headers(req.headers);
  cabecalhos.delete("x-loja-dominio");

  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const slug = dominios.get(host);
  const { pathname } = req.nextUrl;
  if (slug && !SISTEMA.test(pathname)) {
    cabecalhos.set("x-loja-dominio", slug);
    const url = req.nextUrl.clone();
    url.pathname = `/loja/${slug}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url, { request: { headers: cabecalhos } });
  }
  return NextResponse.next({ request: { headers: cabecalhos } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
