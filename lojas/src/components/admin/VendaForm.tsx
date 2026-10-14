"use client";

import { useState } from "react";
import { formatarReais, lerReais, reaisParaCampo } from "@/lib/dinheiro";
import { NOMES_CANAL, NOMES_PAGAMENTO } from "@/lib/rotulos";
import { EscolherProduto, type OpcaoVariante } from "./EscolherProduto";
import { Enviar } from "./Botoes";

type Linha = { v: OpcaoVariante; quantidade: number; preco: string };

export function VendaForm({ opcoes, acao }: { opcoes: OpcaoVariante[]; acao: (fd: FormData) => Promise<void> }) {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [cliente, setCliente] = useState({ nome: "", telefone: "", email: "", documento: "" });
  const [canal, setCanal] = useState("whatsapp");
  const [forma, setForma] = useState("pix");
  const [jaPago, setJaPago] = useState(true);
  const [desconto, setDesconto] = useState("");
  const [frete, setFrete] = useState("");
  const [entrega, setEntrega] = useState<"retirada" | "entrega">("retirada");
  const [endereco, setEndereco] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const subtotal = linhas.reduce((s, l) => s + (lerReais(l.preco) ?? 0) * l.quantidade, 0);
  const descontoC = lerReais(desconto) ?? 0;
  const freteC = lerReais(frete) ?? 0;
  const total = Math.max(0, subtotal - Math.min(descontoC, subtotal) + freteC);

  function adicionar(v: OpcaoVariante) {
    setLinhas((ls) => (ls.some((l) => l.v.id === v.id) ? ls.map((l) => (l.v.id === v.id ? { ...l, quantidade: l.quantidade + 1 } : l)) : [...ls, { v, quantidade: 1, preco: reaisParaCampo(v.precoCentavos) }]));
  }
  const mudar = (id: number, m: Partial<Linha>) => setLinhas((ls) => ls.map((l) => (l.v.id === id ? { ...l, ...m } : l)));

  const venda = JSON.stringify({
    cliente,
    itens: linhas.map((l) => ({ varianteId: l.v.id, quantidade: l.quantidade, precoCentavos: lerReais(l.preco) ?? l.v.precoCentavos })),
    canal,
    formaPagamento: forma,
    jaPago,
    descontoCentavos: descontoC,
    freteCentavos: freteC,
    entrega,
    endereco,
    observacoes,
  });

  return (
    <form action={acao} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <input type="hidden" name="venda" value={venda} />
      <div className="space-y-6">
        <section className="rounded-lg border border-stone-200 bg-white p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold">Produtos</h2>
          <EscolherProduto opcoes={opcoes} aoEscolher={adicionar} />
          {linhas.length > 0 && (
            <ul className="mt-4 divide-y divide-stone-100">
              {linhas.map((l) => (
                <li key={l.v.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <span className="min-w-40 flex-1">
                    {l.v.nome}
                    {l.quantidade > l.v.estoque && <span className="block text-xs text-red-600">Só há {l.v.estoque} em estoque</span>}
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={l.quantidade}
                    onChange={(e) => mudar(l.v.id, { quantidade: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    className="campo w-20"
                    aria-label="Quantidade"
                  />
                  <span className="text-stone-400">×</span>
                  <input value={l.preco} onChange={(e) => mudar(l.v.id, { preco: e.target.value })} className="campo w-28" aria-label="Preço unitário" inputMode="decimal" />
                  <button type="button" className="px-2 text-stone-400 hover:text-red-600" onClick={() => setLinhas((ls) => ls.filter((x) => x.v.id !== l.v.id))} aria-label="Remover">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold">Cliente</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="rotulo">Nome</span><input className="campo" value={cliente.nome} onChange={(e) => setCliente({ ...cliente, nome: e.target.value })} placeholder="Cliente balcão" /></label>
            <label><span className="rotulo">WhatsApp</span><input className="campo" value={cliente.telefone} onChange={(e) => setCliente({ ...cliente, telefone: e.target.value })} inputMode="tel" /></label>
            <label><span className="rotulo">E-mail</span><input className="campo" type="email" value={cliente.email} onChange={(e) => setCliente({ ...cliente, email: e.target.value })} /></label>
            <label><span className="rotulo">CPF/CNPJ</span><input className="campo" value={cliente.documento} onChange={(e) => setCliente({ ...cliente, documento: e.target.value })} /></label>
          </div>
          <p className="mt-2 text-xs text-stone-500">Se o telefone ou e-mail já existir, a venda entra no cadastro desse cliente.</p>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold">Entrega</h2>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="radio" checked={entrega === "retirada"} onChange={() => setEntrega("retirada")} /> Retirada / em mãos</label>
            <label className="flex items-center gap-2"><input type="radio" checked={entrega === "entrega"} onChange={() => setEntrega("entrega")} /> Envio</label>
          </div>
          {entrega === "entrega" && <textarea className="campo mt-3" rows={2} placeholder="Endereço de entrega" value={endereco} onChange={(e) => setEndereco(e.target.value)} />}
          <label className="mt-3 block"><span className="rotulo">Observações</span><textarea className="campo" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></label>
        </section>
      </div>

      <aside className="h-fit space-y-3 rounded-lg border border-stone-200 bg-white p-4 sm:p-5 lg:sticky lg:top-6">
        <label className="block"><span className="rotulo">Canal</span>
          <select className="campo" value={canal} onChange={(e) => setCanal(e.target.value)}>
            {Object.entries(NOMES_CANAL).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
        </label>
        <label className="block"><span className="rotulo">Forma de pagamento</span>
          <select className="campo" value={forma} onChange={(e) => setForma(e.target.value)}>
            {Object.entries(NOMES_PAGAMENTO).filter(([k]) => k !== "mercadopago").map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={jaPago} onChange={(e) => setJaPago(e.target.checked)} /> Já está pago</label>
        <div className="grid grid-cols-2 gap-3">
          <label><span className="rotulo">Desconto (R$)</span><input className="campo" value={desconto} onChange={(e) => setDesconto(e.target.value)} inputMode="decimal" /></label>
          <label><span className="rotulo">Frete (R$)</span><input className="campo" value={frete} onChange={(e) => setFrete(e.target.value)} inputMode="decimal" /></label>
        </div>
        <dl className="space-y-1 border-t border-stone-100 pt-3 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{formatarReais(subtotal)}</dd></div>
          <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatarReais(total)}</dd></div>
        </dl>
        {linhas.length === 0 ? (
          <button type="button" disabled className="botao-primario w-full">Registrar venda</button>
        ) : (
          <Enviar className="botao-primario w-full" pendente="Registrando…">Registrar venda</Enviar>
        )}
      </aside>
    </form>
  );
}
