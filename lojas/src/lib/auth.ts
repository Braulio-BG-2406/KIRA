import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { sessoes, usuarios } from "@/db/schema";
import { conferirSenha, gerarHashSenha } from "./auth-hash";

const COOKIE = "sessao";
const DURACAO_MS = 30 * 86_400_000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// trava simples contra tentativa e erro de senha (por e-mail, na memória do servidor)
const tentativas = new Map<string, { n: number; ate: number }>();

export async function entrar(email: string, senha: string): Promise<string | null> {
  const chave = email.trim().toLowerCase();
  const t = tentativas.get(chave);
  if (t && t.n >= 5 && t.ate > Date.now()) return "Muitas tentativas. Espere 15 minutos.";
  const [usuario] = await db.select().from(usuarios).where(eq(usuarios.email, chave));
  const ok = usuario ? await conferirSenha(senha, usuario.senhaHash) : await gerarHashSenha(senha).then(() => false);
  if (!usuario || !ok) {
    const atual = t && t.ate > Date.now() ? t.n + 1 : 1;
    tentativas.set(chave, { n: atual, ate: Date.now() + 15 * 60_000 });
    return "E-mail ou senha incorretos.";
  }
  tentativas.delete(chave);
  const token = randomBytes(32).toString("base64url");
  await db.delete(sessoes).where(lt(sessoes.expiraEm, new Date()));
  await db.insert(sessoes).values({ id: hashToken(token), usuarioId: usuario.id, expiraEm: new Date(Date.now() + DURACAO_MS) });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && (process.env.APP_URL ?? "").startsWith("https"),
    path: "/",
    maxAge: DURACAO_MS / 1000,
  });
  return null;
}

export async function sair() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessoes).where(eq(sessoes.id, hashToken(token)));
  jar.delete(COOKIE);
}

export async function usuarioAtual() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [linha] = await db
    .select({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email })
    .from(sessoes)
    .innerJoin(usuarios, eq(usuarios.id, sessoes.usuarioId))
    .where(and(eq(sessoes.id, hashToken(token)), gt(sessoes.expiraEm, new Date())));
  return linha ?? null;
}

/** use no começo de toda página e ação do painel */
export async function exigirUsuario() {
  const u = await usuarioAtual();
  if (!u) redirect("/admin/login");
  return u;
}
