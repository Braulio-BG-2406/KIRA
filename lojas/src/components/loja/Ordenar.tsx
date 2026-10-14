"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const OPCOES = [
  ["", "Destaques"],
  ["novidades", "Novidades"],
  ["menor", "Menor preço"],
  ["maior", "Maior preço"],
] as const;

export function Ordenar({ atual }: { atual?: string }) {
  const router = useRouter();
  const caminho = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-stone-500">
      Ordenar
      <select
        value={atual ?? ""}
        onChange={(e) => {
          const q = new URLSearchParams(params);
          if (e.target.value) q.set("ordem", e.target.value);
          else q.delete("ordem");
          router.push(`${caminho}${q.size ? `?${q}` : ""}#produtos`, { scroll: false });
        }}
        className="border-b border-stone-300 bg-transparent py-1 text-sm normal-case tracking-normal text-stone-900 focus:outline-none"
      >
        {OPCOES.map(([v, n]) => (
          <option key={v} value={v}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}
