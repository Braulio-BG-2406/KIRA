"use client";

import { useState } from "react";
import { lerReais } from "@/lib/dinheiro";
import { Enviar } from "./Botoes";

export type VarianteEdicao = { id?: number; nome: string; sku: string; preco: string; precoDe: string; custo: string; estoque: string; ativo: boolean };

type Props = {
  acao: (fd: FormData) => Promise<void>;
  categorias: { id: number; nome: string }[];
  produto?: { id: number; nome: string; slug: string; descricao: string; categoriaId: number | null; ativo: boolean; destaque: boolean };
  variantes: VarianteEdicao[];
};

const nova = (): VarianteEdicao => ({ nome: "", sku: "", preco: "", precoDe: "", custo: "", estoque: "0", ativo: true });

function margem(v: VarianteEdicao) {
  const p = lerReais(v.preco);
  const c = lerReais(v.custo);
  if (!p || c == null || c === 0) return null;
  return Math.round(((p - c) / p) * 100);
}

export function ProdutoForm({ acao, categorias, produto, variantes: iniciais }: Props) {
  const [vs, setVs] = useState<VarianteEdicao[]>(iniciais.length ? iniciais : [{ ...nova(), nome: "Padrão" }]);
  const mudar = (i: number, m: Partial<VarianteEdicao>) => setVs((l) => l.map((v, j) => (j === i ? { ...v, ...m } : v)));

  return (
    <form action={acao} className="space-y-6">
      {produto && <input type="hidden" name="id" value={produto.id} />}
      <input type="hidden" name="variantes" value={JSON.stringify(vs)} />
      <section className="grid gap-4 rounded-lg border border-stone-200 bg-white p-4 sm:grid-cols-2 sm:p-5">
        <label className="sm:col-span-2">
          <span className="rotulo">Nome</span>
          <input name="nome" required defaultValue={produto?.nome} className="campo" />
        </label>
        <label>
          <span className="rotulo">Categoria</span>
          <select name="categoriaId" defaultValue={produto?.categoriaId ?? ""} className="campo">
            <option value="">Sem categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="rotulo">Endereço no site (opcional)</span>
          <input name="slug" defaultValue={produto?.slug} placeholder="gerado pelo nome" className="campo" />
        </label>
        <label className="sm:col-span-2">
          <span className="rotulo">Descrição</span>
          <textarea name="descricao" rows={4} defaultValue={produto?.descricao} className="campo" />
        </label>
        <div className="flex gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="ativo" defaultChecked={produto?.ativo ?? true} /> À venda no site
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="destaque" defaultChecked={produto?.destaque ?? false} /> Destaque na vitrine
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Variações, preço e estoque</h2>
          <button type="button" className="botao-secundario" onClick={() => setVs((l) => [...l, nova()])}>
            + Variação
          </button>
        </div>
        <p className="mb-4 text-xs text-stone-500">Ex.: tamanho do aro, cor, banho. Produto sem variação fica só com &quot;Padrão&quot;. Valores em reais.</p>
        <div className="space-y-3">
          {vs.map((v, i) => {
            const m = margem(v);
            return (
              <div key={v.id ?? `n${i}`} className={`grid grid-cols-2 gap-2 rounded-md border p-3 sm:grid-cols-[1.4fr_1fr_0.9fr_0.9fr_0.9fr_0.7fr_auto] sm:items-end ${v.ativo ? "border-stone-200" : "border-dashed border-stone-300 opacity-60"}`}>
                <label className="col-span-2 sm:col-span-1">
                  <span className="rotulo">Variação</span>
                  <input value={v.nome} onChange={(e) => mudar(i, { nome: e.target.value })} placeholder="Padrão" className="campo" />
                </label>
                <label>
                  <span className="rotulo">SKU</span>
                  <input value={v.sku} onChange={(e) => mudar(i, { sku: e.target.value })} className="campo" />
                </label>
                <label>
                  <span className="rotulo">Preço</span>
                  <input value={v.preco} onChange={(e) => mudar(i, { preco: e.target.value })} required inputMode="decimal" className="campo" />
                </label>
                <label>
                  <span className="rotulo">Preço &quot;de&quot;</span>
                  <input value={v.precoDe} onChange={(e) => mudar(i, { precoDe: e.target.value })} inputMode="decimal" className="campo" />
                </label>
                <label>
                  <span className="rotulo">Custo {m != null && <span className="text-stone-400">· margem {m}%</span>}</span>
                  <input value={v.custo} onChange={(e) => mudar(i, { custo: e.target.value })} inputMode="decimal" className="campo" />
                </label>
                <label>
                  <span className="rotulo">Estoque</span>
                  <input value={v.estoque} onChange={(e) => mudar(i, { estoque: e.target.value })} type="number" min={0} className="campo" />
                </label>
                <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={v.ativo} onChange={(e) => mudar(i, { ativo: e.target.checked })} /> ativa
                  </label>
                  {vs.length > 1 && (
                    <button type="button" className="text-xs text-red-600" onClick={() => setVs((l) => l.filter((_, j) => j !== i))}>
                      remover
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-stone-500">Mudanças no estoque por aqui ficam registradas como ajuste. Para entrada de mercadoria, use Compras.</p>
      </section>

      <div className="flex justify-end">
        <Enviar>Salvar produto</Enviar>
      </div>
    </form>
  );
}
