import "server-only";
import { redirect } from "next/navigation";
import { exigirUsuario } from "./auth";
import { lojaDoPainel } from "./lojas";
import { ErroNegocio } from "./erros";
import { lerReais } from "./dinheiro";
import { agendarSincronizacao } from "./canais/agendar";

/** usuário logado + loja escolhida; use em toda página e ação do painel */
export async function contexto() {
  const usuario = await exigirUsuario();
  const loja = await lojaDoPainel();
  return { usuario, loja };
}

export function comAviso(caminho: string, tipo: "ok" | "erro", mensagem: string) {
  const url = new URL(caminho, "http://x");
  url.searchParams.delete("ok");
  url.searchParams.delete("erro");
  url.searchParams.set(tipo, mensagem);
  return url.pathname + url.search;
}

function violaUnico(e: unknown): boolean {
  const causa = (e as { cause?: { code?: string } })?.cause ?? e;
  return (causa as { code?: string })?.code === "23505";
}

/**
 * Roda a ação e volta para a página com a mensagem de sucesso ou de erro.
 * A função pode devolver outro caminho para onde ir depois (ou { destino, ok }).
 */
export async function executar(
  voltar: string,
  fn: () => Promise<string | void | { destino?: string; ok?: string }>,
  ok = "Salvo.",
): Promise<never> {
  let destino: string;
  try {
    const r = await fn();
    destino = typeof r === "object" ? comAviso(r.destino || voltar, "ok", r.ok || ok) : comAviso(r || voltar, "ok", ok);
    // qualquer mudança no painel pode mexer em estoque ou preço: avisa os marketplaces
    agendarSincronizacao();
  } catch (e) {
    if (e instanceof ErroNegocio) destino = comAviso(voltar, "erro", e.message);
    else if (violaUnico(e)) destino = comAviso(voltar, "erro", "Já existe um cadastro com esse nome ou código.");
    else throw e;
  }
  redirect(destino);
}

export function texto(fd: FormData, nome: string): string {
  return String(fd.get(nome) ?? "").trim();
}

export function textoOuNulo(fd: FormData, nome: string): string | null {
  return texto(fd, nome) || null;
}

export function inteiro(fd: FormData, nome: string, padrao = 0): number {
  const n = parseInt(texto(fd, nome), 10);
  return Number.isFinite(n) ? n : padrao;
}

export function centavos(fd: FormData, nome: string): number | null {
  return lerReais(texto(fd, nome));
}

export function marcado(fd: FormData, nome: string): boolean {
  return fd.get(nome) === "on" || fd.get(nome) === "true";
}
