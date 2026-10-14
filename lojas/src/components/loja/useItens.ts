"use client";

import { useEffect, useState } from "react";
import { useCarrinho, type ItemCarrinho } from "./carrinho";

export type InfoItem = {
  varianteId: number;
  produtoNome: string;
  varianteNome: string;
  produtoSlug: string;
  precoCentavos: number;
  estoque: number;
  disponivel: boolean;
  imagem: string | null;
};

export type LinhaCarrinho = ItemCarrinho & { info?: InfoItem };

/** junta o carrinho do navegador com preço e estoque atuais do servidor */
export function useItensDoCarrinho(slug: string) {
  const carrinho = useCarrinho(slug);
  const [infos, setInfos] = useState<Record<number, InfoItem>>({});
  const [carregando, setCarregando] = useState(true);
  const ids = carrinho.map((i) => i.varianteId).sort().join(",");

  useEffect(() => {
    let ativo = true;
    if (!ids) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    fetch(`/api/loja/${slug}/carrinho`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itens: ids.split(",").map((id) => ({ varianteId: Number(id) })) }),
    })
      .then((r) => r.json())
      .then((d: { itens?: InfoItem[] }) => {
        if (ativo) setInfos(Object.fromEntries((d.itens ?? []).map((i) => [i.varianteId, i])));
      })
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [slug, ids]);

  const linhas: LinhaCarrinho[] = carrinho.map((i) => ({ ...i, info: infos[i.varianteId] }));
  const validas = linhas.filter((l) => l.info?.disponivel && l.info.estoque > 0);
  const subtotal = validas.reduce((s, l) => s + l.info!.precoCentavos * Math.min(l.quantidade, l.info!.estoque), 0);
  return { linhas, validas, subtotal, carregando: carregando && carrinho.length > 0, vazio: carrinho.length === 0 };
}
