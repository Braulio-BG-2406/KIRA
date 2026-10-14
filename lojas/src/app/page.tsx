import Link from "next/link";
import { todasAsLojas } from "@/lib/lojas";

export const dynamic = "force-dynamic";

// página de quem acessa pelo endereço da plataforma (sem domínio de loja)
export default async function Inicio() {
  const lojas = await todasAsLojas();
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-2xl font-semibold">Lojas</h1>
      <ul className="mt-6 space-y-3">
        {lojas.map((l) => (
          <li key={l.id}>
            <Link href={`/loja/${l.slug}`} className="block rounded-lg border border-stone-200 p-4 hover:bg-stone-50">
              <span className="font-medium">{l.nome}</span>
              {l.slogan && <span className="block text-sm text-stone-500">{l.slogan}</span>}
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/admin" className="mt-8 inline-block text-sm text-stone-500 underline">
        Painel de gestão
      </Link>
    </main>
  );
}
