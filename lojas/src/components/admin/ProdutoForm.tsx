"use client";

import { useState } from "react";
import { lerReais } from "@/lib/dinheiro";
import { Enviar } from "./Botoes";

export type VarianteEdicao = {
  id?: number;
  nome: string;
  sku: string;
  codigoBarras: string;
  preco: string;
  precoDe: string;
  custo: string;
  estoque: string;
  ativo: boolean;
};

type Espec = { nome: string; valor: string };

type Props = {
  acao: (fd: FormData) => Promise<void>;
  categorias: { id: number; nome: string }[];
  marcas: string[];
  produto?: {
    id: number;
    nome: string;
    slug: string;
    descricao: string;
    categoriaId: number | null;
    marca: string | null;
    especificacoes: Espec[];
    garantia: string | null;
    itensInclusos: string | null;
    ativo: boolean;
    destaque: boolean;
  };
  variantes: VarianteEdicao[];
};

const nova = (nome = ""): VarianteEdicao => ({ nome, sku: "", codigoBarras: "", preco: "", precoDe: "", custo: "", estoque: "0", ativo: true });

function margem(v: VarianteEdicao) {
  const p = lerReais(v.preco);
  const c = lerReais(v.custo);
  if (!p || c == null || c === 0) return null;
  return Math.round(((p - c) / p) * 100);
}

function Campo({ rotulo, children, className = "" }: { rotulo: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="rotulo">{rotulo}</span>
      {children}
    </label>
  );
}

export function ProdutoForm({ acao, categorias, marcas, produto, variantes: iniciais }: Props) {
  const [vs, setVs] = useState<VarianteEdicao[]>(iniciais.length ? iniciais : [nova("Padrão")]);
  const [comVariacoes, setComVariacoes] = useState(vs.length > 1 || (vs[0] && vs[0].nome !== "Padrão"));
  const [specs, setSpecs] = useState<Espec[]>(produto?.especificacoes ?? []);
  const mudar = (i: number, m: Partial<VarianteEdicao>) => setVs((l) => l.map((v, j) => (j === i ? { ...v, ...m } : v)));
  const temDetalhes = specs.length > 0 || !!produto?.garantia || !!produto?.itensInclusos;

  function alternarVariacoes(sim: boolean) {
    setComVariacoes(sim);
    if (sim && vs.length === 1 && vs[0].nome === "Padrão") mudar(0, { nome: "" });
    // voltar para produto simples fica com a primeira variação; as outras saem ao salvar
    if (!sim) setVs((l) => [{ ...l[0], nome: "Padrão", ativo: true }]);
  }

  const v0 = vs[0];
  const m0 = margem(v0);

  return (
    <form action={acao} className="space-y-5">
      {produto && <input type="hidden" name="id" value={produto.id} />}
      <input type="hidden" name="variantes" value={JSON.stringify(vs)} />
      <input type="hidden" name="especificacoes" value={JSON.stringify(specs.filter((e) => e.nome.trim() && e.valor.trim()))} />

      <section className="grid gap-4 rounded-lg border border-stone-200 bg-white p-4 sm:grid-cols-2 sm:p-5">
        <Campo rotulo="Nome" className="sm:col-span-2">
          <input name="nome" required defaultValue={produto?.nome} className="campo" />
        </Campo>
        <Campo rotulo="Marca">
          <input name="marca" list="marcas-loja" defaultValue={produto?.marca ?? ""} className="campo" />
          <datalist id="marcas-loja">
            {marcas.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Campo>
        <Campo rotulo="Categoria">
          <select name="categoriaId" defaultValue={produto?.categoriaId ?? ""} className="campo">
            <option value="">Sem categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Descrição" className="sm:col-span-2">
          <textarea name="descricao" rows={3} defaultValue={produto?.descricao} className="campo" />
        </Campo>
        <Campo rotulo={produto ? "Adicionar fotos" : "Fotos"} className="sm:col-span-2">
          <input type="file" name="fotos" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="block text-sm" />
          <span className="mt-1 block text-xs text-stone-500">JPG, PNG ou WEBP até 8 MB. A primeira vira a capa.</span>
        </Campo>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Preço e estoque</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={comVariacoes} onChange={(e) => alternarVariacoes(e.target.checked)} /> Tem variações (cor, tamanho, aro…)
          </label>
        </div>

        {!comVariacoes ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Campo rotulo="Preço (R$)">
              <input value={v0.preco} onChange={(e) => mudar(0, { preco: e.target.value })} required inputMode="decimal" className="campo" />
            </Campo>
            <Campo rotulo="Estoque">
              <input value={v0.estoque} onChange={(e) => mudar(0, { estoque: e.target.value })} type="number" min={0} className="campo" />
            </Campo>
            <Campo rotulo={<>Custo (R$) {m0 != null && <span className="text-stone-400">· margem {m0}%</span>}</>}>
              <input value={v0.custo} onChange={(e) => mudar(0, { custo: e.target.value })} inputMode="decimal" className="campo" />
            </Campo>
            <Campo rotulo='Preço "de" (riscado)'>
              <input value={v0.precoDe} onChange={(e) => mudar(0, { precoDe: e.target.value })} inputMode="decimal" className="campo" />
            </Campo>
            <Campo rotulo="Código de barras">
              <input value={v0.codigoBarras} onChange={(e) => mudar(0, { codigoBarras: e.target.value })} inputMode="numeric" className="campo" />
            </Campo>
            <Campo rotulo="SKU">
              <input value={v0.sku} onChange={(e) => mudar(0, { sku: e.target.value })} className="campo" />
            </Campo>
          </div>
        ) : (
          <div className="space-y-3">
            {vs.map((v, i) => {
              const m = margem(v);
              return (
                <div key={v.id ?? `n${i}`} className={`rounded-md border p-3 ${v.ativo ? "border-stone-200" : "border-dashed border-stone-300 opacity-60"}`}>
                  <div className="grid grid-cols-[1.4fr_1fr_0.8fr] gap-2">
                    <Campo rotulo="Variação">
                      <input value={v.nome} onChange={(e) => mudar(i, { nome: e.target.value })} required placeholder="Ex.: Pulseira preta" className="campo" />
                    </Campo>
                    <Campo rotulo="Preço (R$)">
                      <input value={v.preco} onChange={(e) => mudar(i, { preco: e.target.value })} required inputMode="decimal" className="campo" />
                    </Campo>
                    <Campo rotulo="Estoque">
                      <input value={v.estoque} onChange={(e) => mudar(i, { estoque: e.target.value })} type="number" min={0} className="campo" />
                    </Campo>
                  </div>
                  <details className="mt-2 text-sm" open={!!(v.custo || v.sku || v.codigoBarras || v.precoDe)}>
                    <summary className="cursor-pointer text-xs text-stone-500">
                      Custo, código e preço &quot;de&quot;{m != null && ` · margem ${m}%`}
                    </summary>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Campo rotulo="Custo (R$)">
                        <input value={v.custo} onChange={(e) => mudar(i, { custo: e.target.value })} inputMode="decimal" className="campo" />
                      </Campo>
                      <Campo rotulo='Preço "de"'>
                        <input value={v.precoDe} onChange={(e) => mudar(i, { precoDe: e.target.value })} inputMode="decimal" className="campo" />
                      </Campo>
                      <Campo rotulo="Código de barras">
                        <input value={v.codigoBarras} onChange={(e) => mudar(i, { codigoBarras: e.target.value })} inputMode="numeric" className="campo" />
                      </Campo>
                      <Campo rotulo="SKU">
                        <input value={v.sku} onChange={(e) => mudar(i, { sku: e.target.value })} className="campo" />
                      </Campo>
                    </div>
                  </details>
                  <div className="mt-2 flex gap-4 text-xs">
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={v.ativo} onChange={(e) => mudar(i, { ativo: e.target.checked })} /> à venda
                    </label>
                    {vs.length > 1 && (
                      <button type="button" className="text-red-600" onClick={() => setVs((l) => l.filter((_, j) => j !== i))}>
                        remover
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <button type="button" className="botao-secundario" onClick={() => setVs((l) => [...l, { ...nova(), preco: l[l.length - 1]?.preco ?? "", custo: l[l.length - 1]?.custo ?? "" }])}>
              + Variação
            </button>
          </div>
        )}
        <p className="mt-3 text-xs text-stone-500">Mudar o estoque aqui fica registrado como ajuste. Mercadoria que chegou do fornecedor entra por Compras.</p>
      </section>

      <details className="rounded-lg border border-stone-200 bg-white p-4 sm:p-5" open={temDetalhes}>
        <summary className="cursor-pointer text-sm font-semibold">Ficha técnica, garantia e endereço no site</summary>
        <div className="mt-4 space-y-4">
          <div>
            <span className="rotulo">Ficha técnica (aparece na página do produto)</span>
            <div className="space-y-2">
              {specs.map((e, i) => (
                <div key={i} className="flex gap-2">
                  <input value={e.nome} onChange={(ev) => setSpecs((l) => l.map((x, j) => (j === i ? { ...x, nome: ev.target.value } : x)))} placeholder="Ex.: Caixa" className="campo w-40" aria-label="Item" />
                  <input value={e.valor} onChange={(ev) => setSpecs((l) => l.map((x, j) => (j === i ? { ...x, valor: ev.target.value } : x)))} placeholder="Ex.: 42 mm, aço inoxidável" className="campo flex-1" aria-label="Valor" />
                  <button type="button" className="px-2 text-stone-400 hover:text-red-600" onClick={() => setSpecs((l) => l.filter((_, j) => j !== i))} aria-label="Remover item">
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="text-sm underline" onClick={() => setSpecs((l) => [...l, { nome: "", valor: "" }])}>
                + item da ficha
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Garantia">
              <input name="garantia" defaultValue={produto?.garantia ?? ""} placeholder="Ex.: 12 meses" className="campo" />
            </Campo>
            <Campo rotulo="Vem com">
              <input name="itensInclusos" defaultValue={produto?.itensInclusos ?? ""} placeholder="Ex.: estojo e manual" className="campo" />
            </Campo>
            <Campo rotulo="Endereço no site (opcional)" className="sm:col-span-2">
              <input name="slug" defaultValue={produto?.slug} placeholder="gerado pelo nome" className="campo" />
            </Campo>
          </div>
        </div>
      </details>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="ativo" defaultChecked={produto?.ativo ?? true} /> À venda no site
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="destaque" defaultChecked={produto?.destaque ?? false} /> Destaque
          </label>
        </div>
        <Enviar>Salvar produto</Enviar>
      </div>
    </form>
  );
}
