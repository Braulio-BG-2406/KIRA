import "server-only";
import { after } from "next/server";
import { sincronizarTudo } from "./sincronizar";

/** depois de responder ao usuário, manda o estoque novo para os marketplaces */
export function agendarSincronizacao() {
  const rodar = () => sincronizarTudo().catch((e) => console.error("Sincronização dos canais:", e));
  try {
    after(rodar);
  } catch {
    // fora de uma requisição (scripts): roda direto
    void rodar();
  }
}
