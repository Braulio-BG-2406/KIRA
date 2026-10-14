import type { Rastreamento } from "@/db/schema";

// só deixa passar formatos conhecidos: o valor vai parar dentro de <script> e <meta>
export function rastreamentoSeguro(r: Rastreamento | null | undefined): Rastreamento {
  const ok = (v: string | undefined, re: RegExp) => (v && re.test(v.trim()) ? v.trim() : undefined);
  return {
    googleVerificacao: ok(r?.googleVerificacao, /^[\w-]{10,100}$/),
    googleAnalytics: ok(r?.googleAnalytics, /^G-[A-Z0-9]{4,20}$/),
    metaVerificacao: ok(r?.metaVerificacao, /^[a-z0-9]{10,60}$/),
    metaPixel: ok(r?.metaPixel, /^\d{6,20}$/),
  };
}
