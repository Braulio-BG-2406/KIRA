import Link from "next/link";
import type { Loja } from "@/db/schema";
import type { ProdutoVitrine } from "@/lib/catalogo";
import type { Categoria } from "./tipos";
import { GradeProdutos } from "./CartaoProduto";
import { Ordenar } from "./Ordenar";

export const POR_PAGINA = 36;

type Props = {
  loja: Loja;
  base: string;
  titulo: string;
  sobrelinha?: string;
  categorias: Categoria[];
  /** slug da categoria aberta (para marcar o filtro) */
  atual?: string;
  produtos: ProdutoVitrine[];
  pagina: number;
  ordem?: string;
  /** caminho da página, sem a base, para montar os links das páginas */
  caminho: string;
  busca?: string;
};

/** catálogo escuro: filtros por coleção, ordenação e páginas de 36 peças */
export function CatalogoJoalheria({ loja, base, titulo, sobrelinha, categorias, atual, produtos: lista, pagina, ordem, caminho, busca }: Props) {
  let produtos = lista;
  // sem ordem escolhida: disponíveis com foto primeiro, depois sem foto, esgotadas no fim (a ordem dentro de cada grupo é mantida)
  if (!ordem) {
    const peso = (p: ProdutoVitrine) => (p.estoqueTotal > 0 ? 0 : 2) + (p.imagens.length ? 0 : 1);
    produtos = [...produtos].sort((a, b) => peso(a) - peso(b));
  }
  const total = produtos.length;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const pag = Math.min(Math.max(1, pagina), paginas);
  const visiveis = produtos.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA);
  const link = (n: number) => {
    const q = new URLSearchParams();
    if (busca) q.set("q", busca);
    if (ordem) q.set("ordem", ordem);
    if (n > 1) q.set("pagina", String(n));
    return `${base}${caminho}${q.size ? `?${q}` : ""}#produtos`;
  };
  const chip = (ativo: boolean) =>
    `whitespace-nowrap rounded-full border px-4 py-1.5 text-[13px] transition ${ativo ? "border-[#b89a67] bg-[#b89a67]/12 text-[#f3efe6]" : "border-[#30302d] text-[#c2bdb4] hover:border-[#f3efe6]/50 hover:text-[#f3efe6]"}`;
  // janela de números ao redor da página atual
  const numeros = Array.from({ length: paginas }, (_, i) => i + 1).filter((n) => n === 1 || n === paginas || Math.abs(n - pag) <= 2);

  return (
    <div className="mx-auto max-w-[1440px] px-5 pt-10 sm:px-10">
      {sobrelinha && <p className="sobrelinha-j">{sobrelinha}</p>}
      <h1 className="mt-1 font-titulo text-5xl text-[#f3efe6] sm:text-6xl">{titulo}</h1>

      <div className="sem-barra -mx-5 mt-8 flex gap-2 overflow-x-auto px-5 sm:-mx-10 sm:px-10">
        <Link href={`${base}/catalogo`} className={chip(!atual)}>
          Todas
        </Link>
        {categorias.map((c) => (
          <Link key={c.id} href={`${base}/categoria/${c.slug}`} className={chip(atual === c.slug)}>
            {c.nome}
          </Link>
        ))}
      </div>

      <div id="produtos" className="mb-8 mt-6 flex scroll-mt-24 flex-wrap items-center justify-between gap-4 border-y border-[#30302d] py-4">
        <form action={`${base}/busca`} className="w-full max-w-xs">
          <input name="q" type="search" defaultValue={busca} placeholder="Buscar peças" className="campo" aria-label="Buscar peças" />
        </form>
        <div className="flex items-center gap-6">
          <span className="text-[13px] text-[#c2bdb4]">
            {total} {total === 1 ? "peça" : "peças"}
          </span>
          <Ordenar atual={ordem} />
        </div>
      </div>

      <GradeProdutos produtos={visiveis} base={base} condicoes={loja} variante="joalheria" />

      {paginas > 1 && (
        <nav className="mt-14 flex flex-wrap items-center justify-center gap-2" aria-label="Páginas">
          {pag > 1 && (
            <Link href={link(pag - 1)} className={chip(false)}>
              ← Anterior
            </Link>
          )}
          {numeros.map((n, i) => (
            <span key={n} className="flex items-center gap-2">
              {i > 0 && n - numeros[i - 1] > 1 && <span className="text-[#8a857c]">…</span>}
              <Link href={link(n)} className={chip(n === pag)} aria-current={n === pag ? "page" : undefined}>
                {n}
              </Link>
            </span>
          ))}
          {pag < paginas && (
            <Link href={link(pag + 1)} className={chip(false)}>
              Próxima →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
