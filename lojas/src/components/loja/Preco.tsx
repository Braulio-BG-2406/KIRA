import { formatarReais } from "@/lib/dinheiro";

export function Preco({ min, max, de, grande = false }: { min: number; max?: number; de?: number | null; grande?: boolean }) {
  const varia = max != null && max !== min;
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      {de != null && de > min && <span className="text-sm text-stone-400 line-through">{formatarReais(de)}</span>}
      <span className={`${grande ? "text-2xl" : "text-base"} font-semibold text-marca`}>
        {varia && <span className="mr-1 text-xs font-normal text-stone-500">a partir de</span>}
        {formatarReais(min)}
      </span>
    </div>
  );
}
