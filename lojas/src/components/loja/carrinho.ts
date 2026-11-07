"use client";

import { useSyncExternalStore } from "react";

export type ItemCarrinho = { varianteId: number; quantidade: number };

const EVENTO = "carrinho-mudou";
const chave = (slug: string) => `carrinho:${slug}`;
const vazio: ItemCarrinho[] = [];
const cacheLeitura = new Map<string, { bruto: string | null; itens: ItemCarrinho[] }>();

export function lerCarrinho(slug: string): ItemCarrinho[] {
  let bruto: string | null = null;
  try {
    bruto = localStorage.getItem(chave(slug));
  } catch {
    return vazio;
  }
  const cache = cacheLeitura.get(slug);
  if (cache && cache.bruto === bruto) return cache.itens;
  let itens: ItemCarrinho[] = vazio;
  try {
    const lido = JSON.parse(bruto ?? "[]");
    if (Array.isArray(lido)) {
      itens = lido.filter((i) => Number.isInteger(i?.varianteId) && Number.isInteger(i?.quantidade) && i.quantidade > 0);
    }
  } catch {}
  cacheLeitura.set(slug, { bruto, itens });
  return itens;
}

export function salvarCarrinho(slug: string, itens: ItemCarrinho[]) {
  try {
    localStorage.setItem(chave(slug), JSON.stringify(itens.filter((i) => i.quantidade > 0)));
  } catch {}
  window.dispatchEvent(new Event(EVENTO));
}

export function adicionarAoCarrinho(slug: string, varianteId: number, quantidade: number) {
  const itens = lerCarrinho(slug).map((i) => ({ ...i }));
  const atual = itens.find((i) => i.varianteId === varianteId);
  if (atual) atual.quantidade += quantidade;
  else itens.push({ varianteId, quantidade });
  salvarCarrinho(slug, itens);
}

export function useCarrinho(slug: string): ItemCarrinho[] {
  return useSyncExternalStore(
    (avisar) => {
      window.addEventListener(EVENTO, avisar);
      window.addEventListener("storage", avisar);
      return () => {
        window.removeEventListener(EVENTO, avisar);
        window.removeEventListener("storage", avisar);
      };
    },
    () => lerCarrinho(slug),
    () => vazio,
  );
}
