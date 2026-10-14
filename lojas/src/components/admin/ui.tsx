import Link from "next/link";

export function Aviso({ ok, erro }: { ok?: string; erro?: string }) {
  if (!ok && !erro) return null;
  return (
    <p
      role={erro ? "alert" : "status"}
      className={`mb-5 rounded-md border px-4 py-3 text-sm ${erro ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}
    >
      {erro ?? ok}
    </p>
  );
}

export function Cabecalho({ titulo, voltar, children }: { titulo: string; voltar?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      {voltar && (
        <Link href={voltar} className="text-sm text-stone-500 hover:text-stone-800" aria-label="Voltar">
          ←
        </Link>
      )}
      <h1 className="text-xl font-semibold text-stone-900">{titulo}</h1>
      <div className="ml-auto flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function Cartao({ titulo, children, className = "" }: { titulo?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-stone-200 bg-white p-4 sm:p-5 ${className}`}>
      {titulo && <h2 className="mb-4 text-sm font-semibold text-stone-800">{titulo}</h2>}
      {children}
    </section>
  );
}

export function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <p className="text-xs text-stone-500">{rotulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-stone-500">{detalhe}</p>}
    </div>
  );
}

const CORES: Record<string, string> = {
  aguardando_pagamento: "bg-amber-100 text-amber-800",
  pendente: "bg-amber-100 text-amber-800",
  pago: "bg-green-100 text-green-800",
  aprovado: "bg-green-100 text-green-800",
  recebida: "bg-green-100 text-green-800",
  separacao: "bg-blue-100 text-blue-800",
  enviado: "bg-indigo-100 text-indigo-800",
  entregue: "bg-stone-200 text-stone-700",
  cancelado: "bg-red-100 text-red-700",
  cancelada: "bg-red-100 text-red-700",
  estornado: "bg-red-100 text-red-700",
  rascunho: "bg-stone-100 text-stone-700",
};

export function Etiqueta({ valor, texto }: { valor: string; texto: string }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${CORES[valor] ?? "bg-stone-100 text-stone-700"}`}>{texto}</span>;
}

/** tabela com rolagem lateral no celular */
export function Tabela({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[640px] text-left text-sm [&_td]:border-t [&_td]:border-stone-100 [&_td]:px-3 [&_td]:py-2.5 [&_th]:px-3 [&_th]:pb-2 [&_th]:text-xs [&_th]:font-medium [&_th]:text-stone-500">
        {children}
      </table>
    </div>
  );
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-stone-500">{children}</p>;
}
