import Link from "next/link";
import type { Loja } from "@/db/schema";
import type { ProdutoVitrine } from "@/lib/catalogo";
import type { Categoria } from "./tipos";
import { GradeProdutos, type VarianteCartao } from "./CartaoProduto";
import { Ordenar } from "./Ordenar";

export const POR_PAGINA = 36;

/** sem ordem escolhida: disponíveis com foto primeiro, depois sem foto, esgotadas no fim (a ordem dentro de cada grupo é mantida) */
export function ordenarParaVitrine(produtos: ProdutoVitrine[], ordem?: string) {
  if (ordem) return produtos;
  const peso = (p: ProdutoVitrine) => (p.estoqueTotal > 0 ? 0 : 2) + (p.imagens.length ? 0 : 1);
  return [...produtos].sort((a, b) => peso(a) - peso(b));
}

/** os cartões do tema da loja */
export function varianteDoTema(tema: string): VarianteCartao {
  return tema === "joalheria" ? "joalheria" : tema === "relojoaria" ? "relojoaria" : "padrao";
}

/** números das páginas, com reticências, e anterior/próxima */
export function Paginacao({ pagina, paginas, link }: { pagina: number; paginas: number; link: (n: number) => string }) {
  if (paginas <= 1) return null;
  const numeros = Array.from({ length: paginas }, (_, i) => i + 1).filter((n) => n === 1 || n === paginas || Math.abs(n - pagina) <= 2);
  return (
    <nav className="mt-14 flex flex-wrap items-center justify-center gap-2" aria-label="Páginas">
      {pagina > 1 && (
        <Link href={link(pagina - 1)} className="chip-v">
          ← Anterior
        </Link>
      )}
      {numeros.map((n, i) => (
        <span key={n} className="flex items-center gap-2">
          {i > 0 && n - numeros[i - 1] > 1 && <span className="text-[var(--v-apagado)]">…</span>}
          <Link href={link(n)} className="chip-v" data-ativo={n === pagina} aria-current={n === pagina ? "page" : undefined}>
            {n}
          </Link>
        </span>
      ))}
      {pagina < paginas && (
        <Link href={link(pagina + 1)} className="chip-v">
          Próxima →
        </Link>
      )}
    </nav>
  );
}

/** separa a página pedida e monta os links das outras */
export function paginar<T>(itens: T[], pagina: number, base: string, caminho: string, params: Record<string, string | undefined> = {}) {
  const paginas = Math.max(1, Math.ceil(itens.length / POR_PAGINA));
  const pag = Math.min(Math.max(1, pagina || 1), paginas);
  const link = (n: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    if (n > 1) q.set("pagina", String(n));
    return `${base}${caminho}${q.size ? `?${q}` : ""}#produtos`;
  };
  return { visiveis: itens.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA), pagina: pag, paginas, link };
}

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
  /** como contar: ["peça", "peças"] (padrão) ou ["modelo", "modelos"] */
  palavra?: [string, string];
};

/** palavra da contagem e título do catálogo em cada tema */
export function palavrasDoTema(tema: string): { palavra: [string, string]; todas: string } {
  return tema === "relojoaria" ? { palavra: ["modelo", "modelos"], todas: "Todos os modelos" } : { palavra: ["peça", "peças"], todas: "Todas as peças" };
}

/** catálogo com filtros por coleção, busca, ordenação e páginas de 36 peças, nas cores do tema da loja */
export function CatalogoPaginado({ loja, base, titulo, sobrelinha, categorias, atual, produtos, pagina, ordem, caminho, busca, palavra = ["peça", "peças"] }: Props) {
  const lista = ordenarParaVitrine(produtos, ordem);
  const p = paginar(lista, pagina, base, caminho, { q: busca, ordem });

  return (
    <div className="mx-auto max-w-[1440px] px-5 pt-10 sm:px-10">
      {sobrelinha && <p className="sobrelinha-v">{sobrelinha}</p>}
      <h1 className="mt-1 font-titulo text-5xl text-[var(--v-texto)] sm:text-6xl">{titulo}</h1>

      <div className="sem-barra -mx-5 mt-8 flex gap-2 overflow-x-auto px-5 sm:-mx-10 sm:px-10">
        <Link href={`${base}/catalogo`} className="chip-v" data-ativo={!atual}>
          Todas
        </Link>
        {categorias.map((c) => (
          <Link key={c.id} href={`${base}/categoria/${c.slug}`} className="chip-v" data-ativo={atual === c.slug}>
            {c.nome}
          </Link>
        ))}
      </div>

      <div id="produtos" className="mb-8 mt-6 flex scroll-mt-24 flex-wrap items-center justify-between gap-4 border-y border-[var(--v-linha)] py-4">
        <form action={`${base}/busca`} className="w-full max-w-xs">
          <input name="q" type="search" defaultValue={busca} placeholder="Buscar" className="campo" aria-label="Buscar" />
        </form>
        <div className="flex items-center gap-6">
          <span className="text-[13px] text-[var(--v-suave)]">
            {lista.length} {lista.length === 1 ? palavra[0] : palavra[1]}
          </span>
          <Ordenar atual={ordem} />
        </div>
      </div>

      <GradeProdutos produtos={p.visiveis} base={base} condicoes={loja} variante={varianteDoTema(loja.tema)} />
      <Paginacao pagina={p.pagina} paginas={p.paginas} link={p.link} />
    </div>
  );
}
