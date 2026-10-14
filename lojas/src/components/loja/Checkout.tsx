"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatarReais } from "@/lib/dinheiro";
import { UFS, type OpcaoFrete } from "@/lib/frete";
import { soDigitos } from "@/lib/texto";
import { salvarCarrinho } from "./carrinho";
import { useItensDoCarrinho } from "./useItens";

export type OpcaoPagamento = { id: "pix" | "mercadopago" | "whatsapp"; nome: string; detalhe: string };

const enderecoVazio = { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "" };

export function Checkout({ slug, base, pagamentos }: { slug: string; base: string; pagamentos: OpcaoPagamento[] }) {
  const router = useRouter();
  const { validas, subtotal, carregando, vazio } = useItensDoCarrinho(slug);
  const [cliente, setCliente] = useState({ nome: "", email: "", telefone: "", documento: "" });
  const [endereco, setEndereco] = useState(enderecoVazio);
  const [opcoes, setOpcoes] = useState<OpcaoFrete[]>([]);
  const [metodo, setMetodo] = useState<"entrega" | "retirada" | "">("");
  const [metodoEscolhido, setMetodoEscolhido] = useState(false);
  const [cupom, setCupom] = useState("");
  const [desconto, setDesconto] = useState<{ codigo: string; valor: number } | null>(null);
  const [erroCupom, setErroCupom] = useState("");
  const [pagamento, setPagamento] = useState<OpcaoPagamento["id"] | "">(pagamentos[0]?.id ?? "");
  const [observacoes, setObservacoes] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  // opções de frete mudam com a UF e o subtotal
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/loja/${slug}/frete?uf=${endereco.uf}&subtotal=${subtotal}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: { opcoes: OpcaoFrete[] }) => {
        setOpcoes(d.opcoes);
        // quem preencheu o endereço quer receber em casa, até escolher outra opção
        setMetodo((m) =>
          metodoEscolhido && d.opcoes.some((o) => o.metodo === m)
            ? m
            : (d.opcoes.find((o) => o.metodo === "entrega")?.metodo ?? d.opcoes[0]?.metodo ?? ""),
        );
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [slug, endereco.uf, subtotal, metodoEscolhido]);

  // o desconto do cupom depende do subtotal: confere de novo quando ele muda
  useEffect(() => {
    if (desconto) void aplicarCupom(desconto.codigo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  async function buscarCep(cep: string) {
    const n = soDigitos(cep);
    if (n.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${n}/json/`);
      const d = await r.json();
      if (d.erro) return;
      setEndereco((e) => ({
        ...e,
        logradouro: d.logradouro || e.logradouro,
        bairro: d.bairro || e.bairro,
        cidade: d.localidade || e.cidade,
        uf: d.uf || e.uf,
      }));
    } catch {}
  }

  async function aplicarCupom(codigo = cupom) {
    setErroCupom("");
    if (!codigo.trim()) return;
    const r = await fetch(`/api/loja/${slug}/cupom`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo, subtotal }),
    });
    const d = await r.json();
    if (d.ok) setDesconto({ codigo: codigo.trim().toUpperCase(), valor: d.descontoCentavos });
    else {
      setDesconto(null);
      setErroCupom(d.erro);
    }
  }

  const opcaoFrete = opcoes.find((o) => o.metodo === metodo);
  const frete = opcaoFrete?.valorCentavos ?? 0;
  const total = Math.max(0, subtotal - (desconto?.valor ?? 0) + frete);

  async function finalizar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!metodo) return setErro("Escolha como receber o pedido.");
    if (!pagamento) return setErro("Escolha a forma de pagamento.");
    setEnviando(true);
    try {
      const r = await fetch(`/api/loja/${slug}/pedidos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente: { ...cliente, documento: cliente.documento || undefined },
          entrega: metodo === "entrega" ? { metodo, endereco: { ...endereco, complemento: endereco.complemento || undefined } } : { metodo },
          itens: validas.map((l) => ({ varianteId: l.varianteId, quantidade: Math.min(l.quantidade, l.info!.estoque) })),
          cupom: desconto?.codigo,
          pagamento,
          observacoes: observacoes || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.erro ?? "Não foi possível fechar o pedido.");
        setEnviando(false);
        return;
      }
      salvarCarrinho(slug, []);
      if (d.pagarEm) window.location.href = d.pagarEm;
      else router.push(`${base}/pedido/${d.codigo}`);
    } catch {
      setErro("Sem conexão. Tente de novo.");
      setEnviando(false);
    }
  }

  if (vazio) {
    return (
      <p className="py-16 text-center text-stone-600">
        Seu carrinho está vazio.{" "}
        <Link href={base || "/"} className="underline">
          Ver produtos
        </Link>
      </p>
    );
  }

  const campo = (rotulo: string, valor: string, mudar: (v: string) => void, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="rotulo">{rotulo}</span>
      <input className="campo" value={valor} onChange={(e) => mudar(e.target.value)} {...extra} />
    </label>
  );

  return (
    <form onSubmit={finalizar} className="grid gap-10 lg:grid-cols-[1fr_340px]">
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="font-titulo text-2xl text-marca">Seus dados</h2>
          {campo("Nome completo", cliente.nome, (v) => setCliente({ ...cliente, nome: v }), { required: true, autoComplete: "name", name: "nome" })}
          <div className="grid gap-3 sm:grid-cols-2">
            {campo("E-mail", cliente.email, (v) => setCliente({ ...cliente, email: v }), { required: true, type: "email", autoComplete: "email", name: "email" })}
            {campo("WhatsApp", cliente.telefone, (v) => setCliente({ ...cliente, telefone: v }), {
              required: true,
              type: "tel",
              autoComplete: "tel",
              placeholder: "(11) 99999-9999",
              name: "telefone",
            })}
          </div>
          {campo("CPF (opcional, para nota fiscal)", cliente.documento, (v) => setCliente({ ...cliente, documento: v }), { inputMode: "numeric", name: "cpf" })}
        </section>

        <section className="space-y-3">
          <h2 className="font-titulo text-2xl text-marca">Entrega</h2>
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            {campo("CEP", endereco.cep, (v) => setEndereco({ ...endereco, cep: v }), {
              inputMode: "numeric",
              autoComplete: "postal-code",
              onBlur: (e) => buscarCep(e.target.value),
              required: metodo === "entrega",
              name: "cep",
            })}
            {campo("Rua", endereco.logradouro, (v) => setEndereco({ ...endereco, logradouro: v }), { required: metodo === "entrega", name: "rua" })}
          </div>
          <div className="grid gap-3 sm:grid-cols-[120px_1fr_1fr]">
            {campo("Número", endereco.numero, (v) => setEndereco({ ...endereco, numero: v }), { required: metodo === "entrega", name: "numero" })}
            {campo("Complemento", endereco.complemento, (v) => setEndereco({ ...endereco, complemento: v }), { name: "complemento" })}
            {campo("Bairro", endereco.bairro, (v) => setEndereco({ ...endereco, bairro: v }), { required: metodo === "entrega", name: "bairro" })}
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            {campo("Cidade", endereco.cidade, (v) => setEndereco({ ...endereco, cidade: v }), { required: metodo === "entrega", name: "cidade" })}
            <label className="block">
              <span className="rotulo">UF</span>
              <select className="campo" value={endereco.uf} onChange={(e) => setEndereco({ ...endereco, uf: e.target.value })} required={metodo === "entrega"} name="uf">
                <option value="">—</option>
                {UFS.map((uf) => (
                  <option key={uf}>{uf}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="space-y-2 pt-2">
            {opcoes.length === 0 && <p className="text-sm text-stone-500">Informe o CEP para ver as opções de entrega.</p>}
            {opcoes.map((o) => (
              <label key={o.metodo} className="flex cursor-pointer items-start gap-3 rounded-md border border-stone-200 p-3 has-checked:border-marca">
                <input type="radio" name="metodo" checked={metodo === o.metodo}
                  onChange={() => {
                    setMetodo(o.metodo);
                    setMetodoEscolhido(true);
                  }} className="mt-1" />
                <span className="flex-1 text-sm">
                  <span className="font-medium">{o.descricao}</span>
                  <span className="block text-stone-500">{o.prazo}</span>
                </span>
                <span className="text-sm font-medium">{o.valorCentavos === 0 ? "Grátis" : formatarReais(o.valorCentavos)}</span>
              </label>
            ))}
            {metodo === "retirada" && <p className="text-xs text-stone-500">Na retirada, o endereço acima não é obrigatório.</p>}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="font-titulo text-2xl text-marca">Pagamento</h2>
          {pagamentos.length === 0 && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">A loja ainda não configurou o pagamento. Fale com a gente pelo WhatsApp.</p>
          )}
          {pagamentos.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-start gap-3 rounded-md border border-stone-200 p-3 has-checked:border-marca">
              <input type="radio" name="pagamento" checked={pagamento === p.id} onChange={() => setPagamento(p.id)} className="mt-1" />
              <span className="text-sm">
                <span className="font-medium">{p.nome}</span>
                <span className="block text-stone-500">{p.detalhe}</span>
              </span>
            </label>
          ))}
        </section>

        <label className="block">
          <span className="rotulo">Observações (opcional)</span>
          <textarea className="campo" rows={2} maxLength={500} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </label>
      </div>

      <aside className="h-fit space-y-4 rounded-lg bg-stone-50 p-5 lg:sticky lg:top-28">
        <h2 className="font-medium">Resumo</h2>
        <ul className="space-y-2 text-sm">
          {validas.map((l) => (
            <li key={l.varianteId} className="flex justify-between gap-3">
              <span>
                {Math.min(l.quantidade, l.info!.estoque)}× {l.info!.produtoNome}
                {l.info!.varianteNome !== "Padrão" && <span className="text-stone-500"> ({l.info!.varianteNome})</span>}
              </span>
              <span>{formatarReais(l.info!.precoCentavos * Math.min(l.quantidade, l.info!.estoque))}</span>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input className="campo" placeholder="Cupom" value={cupom} onChange={(e) => setCupom(e.target.value)} aria-label="Cupom de desconto" />
          <button type="button" className="botao-secundario" onClick={() => aplicarCupom()}>
            Aplicar
          </button>
        </div>
        {erroCupom && <p className="text-xs text-red-600">{erroCupom}</p>}
        <dl className="space-y-1 border-t border-stone-200 pt-3 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatarReais(subtotal)}</dd>
          </div>
          {desconto && (
            <div className="flex justify-between text-green-700">
              <dt>Cupom {desconto.codigo}</dt>
              <dd>− {formatarReais(desconto.valor)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Frete</dt>
            <dd>{opcaoFrete ? (frete === 0 ? "Grátis" : formatarReais(frete)) : "—"}</dd>
          </div>
          <div className="flex justify-between pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd>{formatarReais(total)}</dd>
          </div>
        </dl>
        {erro && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-700" role="alert">
            {erro}
          </p>
        )}
        <button
          type="submit"
          disabled={enviando || carregando || validas.length === 0 || pagamentos.length === 0}
          className="w-full rounded-md bg-marca py-3.5 font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {enviando ? "Enviando…" : "Fechar pedido"}
        </button>
      </aside>
    </form>
  );
}
