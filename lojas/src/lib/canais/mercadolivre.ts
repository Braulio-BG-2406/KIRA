import type { Canal, CredenciaisCanal } from "@/db/schema";
import { centavosDeReais, ErroCanal, tokenValido, type Conector, type PedidoExterno } from "./comum";

// API do Mercado Livre (developers.mercadolivre.com.br). Um app só para a plataforma
// (ML_CLIENT_ID / ML_CLIENT_SECRET); cada loja autoriza a própria conta de vendedor.

const API = "https://api.mercadolibre.com";
const AUTORIZACAO = "https://auth.mercadolivre.com.br/authorization";

export function mlConfigurado(): boolean {
  return !!(process.env.ML_CLIENT_ID && process.env.ML_CLIENT_SECRET);
}

export function mlLinkAutorizacao(redirect: string, estado: string): string {
  const q = new URLSearchParams({ response_type: "code", client_id: process.env.ML_CLIENT_ID ?? "", redirect_uri: redirect, state: estado });
  return `${AUTORIZACAO}?${q}`;
}

async function lerResposta(r: Response, oQue: string) {
  const texto = await r.text();
  let corpo: Record<string, unknown> = {};
  try {
    corpo = JSON.parse(texto);
  } catch {}
  if (!r.ok) {
    const causas = Array.isArray(corpo.cause) ? (corpo.cause as { message?: string }[]).map((c) => c.message).filter(Boolean).join("; ") : "";
    throw new ErroCanal(`Mercado Livre recusou ${oQue} (${r.status}): ${[corpo.message, causas].filter(Boolean).join(" — ") || texto.slice(0, 200)}`);
  }
  return corpo;
}

async function token(corpo: Record<string, string>): Promise<CredenciaisCanal> {
  const r = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: process.env.ML_CLIENT_ID ?? "", client_secret: process.env.ML_CLIENT_SECRET ?? "", ...corpo }),
  });
  const d = (await lerResposta(r, "a autorização")) as { access_token: string; refresh_token: string; expires_in: number; user_id: number };
  return {
    accessToken: d.access_token,
    refreshToken: d.refresh_token,
    expiraEm: new Date(Date.now() + d.expires_in * 1000).toISOString(),
    contaId: String(d.user_id),
  };
}

async function chamar(canal: Canal, metodo: string, caminho: string, corpo?: unknown) {
  const cred = await tokenValido(canal, mercadoLivre.renovar);
  const r = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${cred.accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  return lerResposta(r, `${metodo} ${caminho.split("?")[0]}`);
}

const STATUS: Record<string, PedidoExterno["status"]> = { paid: "pago", cancelled: "cancelado", invalid: "cancelado" };

export const mercadoLivre: Conector = {
  async trocarCodigo(codigo, extra) {
    const cred = await token({ grant_type: "authorization_code", code: codigo, redirect_uri: extra.redirect });
    try {
      const r = await fetch(`${API}/users/me`, { headers: { Authorization: `Bearer ${cred.accessToken}` } });
      if (r.ok) cred.contaNome = ((await r.json()) as { nickname?: string }).nickname;
    } catch {}
    return cred;
  },

  async renovar(cred) {
    const nova = await token({ grant_type: "refresh_token", refresh_token: cred.refreshToken });
    return { ...nova, contaNome: cred.contaNome };
  },

  async atualizarAnuncio(canal, anuncio, { estoque, precoCentavos }) {
    if (anuncio.externoVarianteId) {
      // em anúncio com variações, o estoque vai por variação (o preço fica com o anúncio)
      await chamar(canal, "PUT", `/items/${anuncio.externoId}`, {
        variations: [{ id: Number(anuncio.externoVarianteId), available_quantity: estoque }],
      });
    } else {
      await chamar(canal, "PUT", `/items/${anuncio.externoId}`, {
        available_quantity: estoque,
        ...(precoCentavos != null ? { price: precoCentavos / 100 } : {}),
      });
    }
  },

  async lerAnuncio(canal, id) {
    const d = (await chamar(canal, "GET", `/items/${encodeURIComponent(id)}`)) as {
      id: string;
      title: string;
      permalink?: string;
      variations?: { id: number; attribute_combinations?: { value_name?: string }[]; seller_custom_field?: string | null }[];
    };
    return {
      id: d.id,
      titulo: d.title,
      link: d.permalink,
      variacoes: (d.variations ?? []).map((v) => ({
        id: String(v.id),
        nome: (v.attribute_combinations ?? []).map((a) => a.value_name).filter(Boolean).join(" / ") || String(v.id),
        sku: v.seller_custom_field ?? null,
      })),
    };
  },

  async buscarPedido(canal, id) {
    const d = (await chamar(canal, "GET", `/orders/${encodeURIComponent(id)}`)) as {
      id: number;
      status: string;
      buyer?: { nickname?: string; first_name?: string; last_name?: string; email?: string };
      order_items: { item: { id: string; title: string; variation_id?: number | null; seller_sku?: string | null }; quantity: number; unit_price: number }[];
    };
    const b = d.buyer ?? {};
    return {
      id: String(d.id),
      status: STATUS[d.status] ?? "pendente",
      comprador: { nome: [b.first_name, b.last_name].filter(Boolean).join(" ") || b.nickname || "Cliente Mercado Livre", email: b.email ?? null },
      itens: d.order_items.map((i) => ({
        externoId: i.item.id,
        externoVarianteId: i.item.variation_id ? String(i.item.variation_id) : "",
        sku: i.item.seller_sku ?? null,
        titulo: i.item.title,
        quantidade: i.quantity,
        precoUnitCentavos: centavosDeReais(i.unit_price),
      })),
      endereco: "Envio pelo Mercado Livre (etiqueta no painel do ML)",
    };
  },

  async pedidosRecentes(canal) {
    const d = (await chamar(canal, "GET", `/orders/search?seller=${canal.credenciais?.contaId}&sort=date_desc&limit=30`)) as { results?: { id: number }[] };
    return (d.results ?? []).map((o) => String(o.id));
  },
};

/** publica um anúncio novo; devolve id e link */
export async function mlPublicar(
  canal: Canal,
  p: {
    titulo: string;
    descricao: string;
    precoCentavos: number;
    estoque: number;
    imagens: string[];
    marca?: string | null;
    modelo?: string | null;
    sku?: string | null;
    codigoBarras?: string | null;
    garantia?: string | null;
  },
): Promise<{ id: string; link: string | null }> {
  if (p.imagens.length === 0) throw new ErroCanal("O Mercado Livre exige pelo menos uma foto.");
  if (p.estoque < 1) throw new ErroCanal("Sem estoque: o Mercado Livre só aceita anúncio com pelo menos 1 unidade.");
  const titulo = p.titulo.slice(0, 60);
  // o próprio ML sugere a categoria pelo título
  const previsao = (await chamar(canal, "GET", `/sites/MLB/domain_discovery/search?limit=1&q=${encodeURIComponent(titulo)}`)) as unknown as {
    category_id: string;
  }[];
  const categoria = Array.isArray(previsao) ? previsao[0]?.category_id : undefined;
  if (!categoria) throw new ErroCanal("O Mercado Livre não sugeriu categoria para este título. Publique pelo site do ML e vincule aqui.");
  const atributos = [
    { id: "BRAND", value_name: p.marca || "Genérica" },
    { id: "MODEL", value_name: (p.modelo || titulo).slice(0, 60) },
    ...(p.sku ? [{ id: "SELLER_SKU", value_name: p.sku }] : []),
    ...(p.codigoBarras ? [{ id: "GTIN", value_name: p.codigoBarras }] : []),
  ];
  const item = (await chamar(canal, "POST", "/items", {
    title: titulo,
    category_id: categoria,
    price: p.precoCentavos / 100,
    currency_id: "BRL",
    available_quantity: p.estoque,
    buying_mode: "buy_it_now",
    condition: "new",
    listing_type_id: canal.config.tipoAnuncio ?? "gold_special",
    pictures: p.imagens.slice(0, 10).map((source) => ({ source })),
    attributes: atributos,
    ...(p.garantia
      ? { sale_terms: [{ id: "WARRANTY_TYPE", value_name: "Garantia do vendedor" }, { id: "WARRANTY_TIME", value_name: p.garantia.slice(0, 40) }] }
      : {}),
  })) as { id: string; permalink?: string };
  try {
    await chamar(canal, "POST", `/items/${item.id}/description`, { plain_text: p.descricao.slice(0, 5000) });
  } catch {
    // anúncio já foi criado; sem descrição não impede a venda
  }
  return { id: item.id, link: item.permalink ?? null };
}
