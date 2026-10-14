"use client";

import { useState } from "react";
import { formatarReais, lerReais, reaisParaCampo } from "@/lib/dinheiro";
import { EscolherProduto, type OpcaoVariante } from "./EscolherProduto";
import { Enviar } from "./Botoes";

type Linha = { v: OpcaoVariante; quantidade: number; custo: string };

export function CompraForm({ opcoes, fornecedores, acao }: { opcoes: OpcaoVariante[]; fornecedores: { id: number; nome: string }[]; acao: (fd: FormData) => Promise<void> }) {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [frete, setFrete] = useState("");
  const totalItens = linhas.reduce((s, l) => s + (lerReais(l.custo) ?? 0) * l.quantidade, 0);
  const total = totalItens + (lerReais(frete) ?? 0);
  const mudar = (id: number, m: Partial<Linha>) => setLinhas((ls) => ls.map((l) => (l.v.id === id ? { ...l, ...m } : l)));

  return (
    <form action={acao} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <input
        type="hidden"
        name="itens"
        value={JSON.stringify(linhas.map((l) => ({ varianteId: l.v.id, quantidade: l.quantidade, custoUnitCentavos: lerReais(l.custo) ?? 0 })))}
      />
      <section className="rounded-lg border border-stone-200 bg-white p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold">Itens</h2>
        <EscolherProduto
          opcoes={opcoes}
          mostrarSemEstoque
          aoEscolher={(v) => setLinhas((ls) => (ls.some((l) => l.v.id === v.id) ? ls : [...ls, { v, quantidade: 1, custo: reaisParaCampo(v.custoCentavos) }]))}
        />
        {linhas.length > 0 && (
          <ul className="mt-4 divide-y divide-stone-100">
            {linhas.map((l) => (
              <li key={l.v.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="min-w-40 flex-1">{l.v.nome}</span>
                <input type="number" min={1} value={l.quantidade} onChange={(e) => mudar(l.v.id, { quantidade: Math.max(1, parseInt(e.target.value, 10) || 1) })} className="campo w-20" aria-label="Quantidade" />
                <span className="text-stone-400">× custo</span>
                <input value={l.custo} onChange={(e) => mudar(l.v.id, { custo: e.target.value })} className="campo w-28" inputMode="decimal" aria-label="Custo unitário" />
                <button type="button" className="px-2 text-stone-400 hover:text-red-600" onClick={() => setLinhas((ls) => ls.filter((x) => x.v.id !== l.v.id))} aria-label="Remover">✕</button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-stone-500">Produto novo? Cadastre em Produtos com estoque 0 e depois lance aqui.</p>
      </section>
      <aside className="h-fit space-y-3 rounded-lg border border-stone-200 bg-white p-4 sm:p-5">
        <label className="block">
          <span className="rotulo">Fornecedor</span>
          <select name="fornecedorId" className="campo" defaultValue="">
            <option value="">—</option>
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="rotulo">Frete / taxas (R$)</span>
          <input name="frete" value={frete} onChange={(e) => setFrete(e.target.value)} className="campo" inputMode="decimal" />
          <span className="mt-1 block text-xs text-stone-500">Entra no custo dos itens, dividido pelo valor de cada um.</span>
        </label>
        <label className="block">
          <span className="rotulo">Vencimento do pagamento</span>
          <input name="vencimento" type="date" className="campo" />
        </label>
        <label className="block">
          <span className="rotulo">Observações</span>
          <textarea name="observacoes" rows={2} className="campo" />
        </label>
        <p className="flex justify-between border-t border-stone-100 pt-3 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatarReais(total)}</span>
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="receber" defaultChecked /> Mercadoria já chegou (dar entrada no estoque)
        </label>
        {linhas.length ? <Enviar className="botao-primario w-full">Salvar compra</Enviar> : <button disabled className="botao-primario w-full">Salvar compra</button>}
      </aside>
    </form>
  );
}
