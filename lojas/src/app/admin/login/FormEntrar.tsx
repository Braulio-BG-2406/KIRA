"use client";

import { useActionState } from "react";
import { acaoEntrar } from "../acoes";

export function FormEntrar() {
  const [erro, enviar, pendente] = useActionState(acaoEntrar, null);
  return (
    <form action={enviar} className="space-y-4">
      <label className="block">
        <span className="rotulo">E-mail</span>
        <input name="email" type="email" required autoComplete="username" className="campo" />
      </label>
      <label className="block">
        <span className="rotulo">Senha</span>
        <input name="senha" type="password" required autoComplete="current-password" className="campo" />
      </label>
      {erro && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
          {erro}
        </p>
      )}
      <button className="botao-primario w-full" disabled={pendente}>
        {pendente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
