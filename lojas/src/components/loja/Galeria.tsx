"use client";

import { useState } from "react";
import { FotoProduto } from "./FotoProduto";

export function Galeria({ imagens, nome, relojoaria = false }: { imagens: string[]; nome: string; relojoaria?: boolean }) {
  const [atual, setAtual] = useState(0);
  return (
    <div>
      <div className={`aspect-square overflow-hidden ${relojoaria ? "bg-[#efeeea]" : "rounded-xl bg-stone-100"}`}>
        <FotoProduto url={imagens[atual]} nome={nome} />
      </div>
      {imagens.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {imagens.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setAtual(i)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 ${i === atual ? "border-marca" : "border-transparent"}`}
              aria-label={`Foto ${i + 1}`}
            >
              <FotoProduto url={url} nome={nome} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
