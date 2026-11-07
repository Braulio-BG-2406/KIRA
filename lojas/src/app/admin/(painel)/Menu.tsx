"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Secao = { nome: string; href: string; icone: string; abas: [string, string][] };

// 7 seções; o que é parecido fica em abas dentro da seção
const SECOES: Secao[] = [
  { nome: "Início", href: "/admin", icone: "M3 11l9-8 9 8M5 10v10h14V10", abas: [] },
  {
    nome: "Vendas",
    href: "/admin/pedidos",
    icone: "M6 7h12l-1 13H7L6 7Zm3 0a3 3 0 0 1 6 0",
    abas: [["/admin/pedidos", "Pedidos"], ["/admin/pedidos/novo", "Nova venda"], ["/admin/clientes", "Clientes"], ["/admin/cupons", "Cupons"]],
  },
  {
    nome: "Produtos",
    href: "/admin/produtos",
    icone: "M4 7l8-4 8 4-8 4-8-4Zm0 0v10l8 4 8-4V7M12 11v10",
    abas: [["/admin/produtos", "Produtos"], ["/admin/estoque", "Estoque"], ["/admin/categorias", "Categorias"], ["/admin/produtos/importar", "Importar"]],
  },
  { nome: "Compras", href: "/admin/compras", icone: "M3 4h2l2 12h11l2-8H6M9 20h.01M17 20h.01", abas: [["/admin/compras", "Compras"], ["/admin/fornecedores", "Fornecedores"]] },
  { nome: "Financeiro", href: "/admin/financeiro", icone: "M4 19V5m0 14h16M8 15v-4m4 4V8m4 7v-6", abas: [["/admin/financeiro", "Contas"], ["/admin/relatorios", "Relatórios"]] },
  { nome: "Canais", href: "/admin/canais", icone: "M4 12h16M12 4a12 12 0 0 1 0 16M12 4a12 12 0 0 0 0 16M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16Z", abas: [] },
  { nome: "Ajustes", href: "/admin/configuracoes", icone: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-3 2-1-2-4-2 1-2-1V5h-4l-.5 2-2 1-2-1-2 4 2 1v2l-2 1 2 4 2-1 2 1 .5 2h4V19l2-1 2 1 2-4-2-1v-2Z", abas: [] },
];

function secaoAtual(caminho: string): Secao {
  // aba mais específica primeiro (ex.: /admin/pedidos/novo antes de /admin/pedidos)
  let melhor: { s: Secao; n: number } = { s: SECOES[0], n: 0 };
  for (const s of SECOES) {
    for (const href of [s.href, ...s.abas.map((a) => a[0])]) {
      const casa = href === "/admin" ? caminho === "/admin" : caminho === href || caminho.startsWith(href + "/");
      if (casa && href.length > melhor.n) melhor = { s, n: href.length };
    }
  }
  return melhor.s;
}

function abaAtual(s: Secao, caminho: string): string | null {
  let melhor: string | null = null;
  for (const [href] of s.abas) if ((caminho === href || caminho.startsWith(href + "/")) && href.length > (melhor?.length ?? 0)) melhor = href;
  return melhor;
}

function Icone({ d }: { d: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** menu lateral no computador */
export function MenuLateral() {
  const caminho = usePathname();
  const atual = secaoAtual(caminho);
  return (
    <nav className="hidden space-y-0.5 px-3 text-sm lg:block">
      {SECOES.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className={`flex items-center gap-3 rounded-md px-3 py-2 ${s === atual ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}
        >
          <Icone d={s.icone} />
          {s.nome}
        </Link>
      ))}
    </nav>
  );
}

/** abas da seção, em cima do conteúdo */
export function Abas() {
  const caminho = usePathname();
  const s = secaoAtual(caminho);
  if (s.abas.length === 0) return null;
  const aba = abaAtual(s, caminho);
  return (
    <div className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-stone-200 px-4 text-sm sm:mx-0 sm:px-0 print:hidden">
      {s.abas.map(([href, nome]) => (
        <Link
          key={href}
          href={href}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 ${href === aba ? "border-stone-900 font-medium text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"}`}
        >
          {nome}
        </Link>
      ))}
    </div>
  );
}

/** barra de baixo no celular: o que mais se usa + "Mais" */
export function BarraCelular({ extra }: { extra: React.ReactNode }) {
  const caminho = usePathname();
  const atual = secaoAtual(caminho);
  const [aberto, setAberto] = useState(false);
  const item = (s: Secao) => (
    <Link
      key={s.href}
      href={s.href}
      onClick={() => setAberto(false)}
      className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${s === atual ? "text-stone-900" : "text-stone-500"}`}
    >
      <Icone d={s.icone} />
      {s.nome}
    </Link>
  );
  const [inicio, vendas, produtos, ...resto] = SECOES;
  return (
    <>
      {aberto && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setAberto(false)}>
          <div className="absolute inset-x-0 bottom-16 rounded-t-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-4 gap-2">{resto.map(item)}</div>
            <div className="mt-4 border-t border-stone-100 pt-4">{extra}</div>
          </div>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden">
        {item(inicio)}
        {item(vendas)}
        <Link href="/admin/pedidos/novo" onClick={() => setAberto(false)} className="flex flex-1 flex-col items-center justify-center" aria-label="Nova venda">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-900 text-2xl leading-none text-white">+</span>
        </Link>
        {item(produtos)}
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${resto.includes(atual) || aberto ? "text-stone-900" : "text-stone-500"}`}
        >
          <Icone d="M5 12h.01M12 12h.01M19 12h.01" />
          Mais
        </button>
      </nav>
    </>
  );
}
