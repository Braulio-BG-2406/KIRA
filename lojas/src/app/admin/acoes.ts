"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { entrar, exigirUsuario, sair } from "@/lib/auth";
import { todasAsLojas } from "@/lib/lojas";

export async function acaoEntrar(_estado: string | null, fd: FormData): Promise<string | null> {
  const erro = await entrar(String(fd.get("email") ?? ""), String(fd.get("senha") ?? ""));
  if (erro) return erro;
  redirect("/admin");
}

export async function acaoSair() {
  await sair();
  redirect("/admin/login");
}

export async function acaoTrocarLoja(fd: FormData) {
  await exigirUsuario();
  const slug = String(fd.get("loja") ?? "");
  if ((await todasAsLojas()).some((l) => l.slug === slug)) {
    (await cookies()).set("loja_painel", slug, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 365 * 86400 });
  }
  redirect("/admin");
}
