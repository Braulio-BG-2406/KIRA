"use client";

import { useEffect } from "react";

type Janela = Window & { gtag?: (...a: unknown[]) => void; fbq?: (...a: unknown[]) => void };

/** avisa Google e Meta da venda uma vez só por pedido (para medir anúncios) */
export function EventoCompra({ codigo, valorCentavos }: { codigo: string; valorCentavos: number }) {
  useEffect(() => {
    const chave = `compra-enviada:${codigo}`;
    try {
      if (localStorage.getItem(chave)) return;
      localStorage.setItem(chave, "1");
    } catch {
      return;
    }
    const w = window as Janela;
    const value = valorCentavos / 100;
    // os scripts carregam depois da página; tenta por alguns segundos
    let tentativas = 0;
    const timer = setInterval(() => {
      tentativas++;
      if (w.gtag || w.fbq || tentativas > 10) {
        clearInterval(timer);
        w.gtag?.("event", "purchase", { transaction_id: codigo, value, currency: "BRL" });
        w.fbq?.("track", "Purchase", { value, currency: "BRL" });
      }
    }, 500);
    return () => clearInterval(timer);
  }, [codigo, valorCentavos]);
  return null;
}
