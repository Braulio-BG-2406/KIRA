"use client";

import { useState } from "react";

export function Copiar({ texto, rotulo = "Copiar código" }: { texto: string; rotulo?: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      className="botao-primario w-full"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2500);
        } catch {}
      }}
    >
      {copiado ? "Copiado!" : rotulo}
    </button>
  );
}
