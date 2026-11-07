"use client";

import { useFormStatus } from "react-dom";

export function Enviar({ children, className = "botao-primario", pendente = "Salvando…" }: { children: React.ReactNode; className?: string; pendente?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendente : children}
    </button>
  );
}

/** botão que pede confirmação antes de enviar o formulário */
export function Confirmar({ children, pergunta, className = "botao-perigo" }: { children: React.ReactNode; pergunta: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (!confirm(pergunta)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

export function Imprimir() {
  return (
    <button type="button" className="botao-secundario print:hidden" onClick={() => window.print()}>
      Imprimir
    </button>
  );
}
