"use client";

import { useState } from "react";
import { EscolherProduto, type OpcaoVariante } from "./EscolherProduto";
import { Enviar } from "./Botoes";

export function AjusteEstoque({ opcoes, acao }: { opcoes: OpcaoVariante[]; acao: (fd: FormData) => Promise<void> }) {
  const [v, setV] = useState<OpcaoVariante | null>(null);
  return (
    <form action={acao} className="space-y-3">
      {v ? (
        <div className="flex items-center justify-between rounded-md bg-stone-50 px-3 py-2 text-sm">
          <span>
            {v.nome} <span className="text-stone-500">· {v.estoque} em estoque</span>
          </span>
          <button type="button" className="text-xs underline" onClick={() => setV(null)}>trocar</button>
          <input type="hidden" name="varianteId" value={v.id} />
        </div>
      ) : (
        <EscolherProduto opcoes={opcoes} aoEscolher={setV} mostrarSemEstoque />
      )}
      <div className="grid grid-cols-2 gap-2">
        <select name="modo" className="campo" defaultValue="entrada">
          <option value="entrada">Entrada (+)</option>
          <option value="saida">Saída (−)</option>
          <option value="contagem">Contagem (fica igual a)</option>
        </select>
        <input name="quantidade" type="number" min={0} required placeholder="Qtd." className="campo" />
      </div>
      <input name="nota" placeholder="Motivo (ex.: perda, brinde, contagem)" className="campo" />
      {v ? <Enviar className="botao-primario w-full">Registrar</Enviar> : <button disabled className="botao-primario w-full">Escolha um produto</button>}
    </form>
  );
}
