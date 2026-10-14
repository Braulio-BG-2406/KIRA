"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS = [
  ["/admin", "Início"],
  ["/admin/pedidos", "Pedidos"],
  ["/admin/pedidos/novo", "Nova venda"],
  ["/admin/produtos", "Produtos"],
  ["/admin/categorias", "Categorias"],
  ["/admin/estoque", "Estoque"],
  ["/admin/clientes", "Clientes"],
  ["/admin/compras", "Compras"],
  ["/admin/fornecedores", "Fornecedores"],
  ["/admin/financeiro", "Financeiro"],
  ["/admin/cupons", "Cupons"],
  ["/admin/relatorios", "Relatórios"],
  ["/admin/configuracoes", "Configurações"],
] as const;

export function Menu() {
  const atual = usePathname();
  const ativo = (href: string) => (href === "/admin" ? atual === href : atual === href || (atual.startsWith(href + "/") && !(href === "/admin/pedidos" && atual === "/admin/pedidos/novo")));
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 text-sm lg:flex-col lg:overflow-visible lg:px-3 lg:pb-0">
      {ITENS.map(([href, nome]) => (
        <Link
          key={href}
          href={href}
          className={`whitespace-nowrap rounded-md px-3 py-2 ${ativo(href) ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}
        >
          {nome}
        </Link>
      ))}
    </nav>
  );
}
