import { createHmac, timingSafeEqual } from "node:crypto";
import type { Canal, CredenciaisCanal } from "@/db/schema";
import { centavosDeReais, ErroCanal, tokenValido, type Conector, type PedidoExterno } from "./comum";

// Shopee Open Platform v2. Exige conta de desenvolvedor aprovada na Shopee
// (SHOPEE_PARTNER_ID / SHOPEE_PARTNER_KEY); cada loja autoriza a própria loja da Shopee.

function host() {
  return process.env.SHOPEE_AMBIENTE === "teste" ? "https://partner.test-stable.shopeemobile.com" : "https://partner.shopeemobile.com";
}
const parceiro = () => Number(process.env.SHOPEE_PARTNER_ID ?? 0);

export function shopeeConfigurado(): boolean {
  return !!(process.env.SHOPEE_PARTNER_ID && process.env.SHOPEE_PARTNER_KEY);
}

/** assinatura HMAC-SHA256 que a Shopee pede em toda chamada */
export function assinar(base: string): string {
  return createHmac("sha256", process.env.SHOPEE_PARTNER_KEY ?? "").update(base).digest("hex");
}

const agora = () => Math.floor(Date.now() / 1000);

export function shopeeLinkAutorizacao(redirect: string): string {
  const caminho = "/api/v2/shop/auth_partner";
  const ts = agora();
  const q = new URLSearchParams({ partner_id: String(parceiro()), timestamp: String(ts), sign: assinar(`${parceiro()}${caminho}${ts}`), redirect });
  return `${host()}${caminho}?${q}`;
}

/** confere o aviso (push) da Shopee: Authorization = HMAC(url|corpo) */
export function avisoShopeeValido(url: string, corpo: string, assinatura: string | null): boolean {
  if (!assinatura || !process.env.SHOPEE_PARTNER_KEY) return false;
  const esperado = Buffer.from(assinar(`${url}|${corpo}`));
  const recebido = Buffer.from(assinatura);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

type Resposta = { error?: string; message?: string; response?: unknown; [k: string]: unknown };

async function ler(r: Response, oQue: string): Promise<Resposta> {
  const texto = await r.text();
  let d: Resposta = {};
  try {
    d = JSON.parse(texto);
  } catch {}
  if (!r.ok || d.error) throw new ErroCanal(`Shopee recusou ${oQue}: ${d.message || d.error || r.status}`);
  return d;
}

async function tokenPublico(caminho: string, corpo: Record<string, unknown>, shopId: string): Promise<CredenciaisCanal> {
  const ts = agora();
  const q = new URLSearchParams({ partner_id: String(parceiro()), timestamp: String(ts), sign: assinar(`${parceiro()}${caminho}${ts}`) });
  const r = await fetch(`${host()}${caminho}?${q}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...corpo, partner_id: parceiro(), shop_id: Number(shopId) }),
  });
  const d = (await ler(r, "a autorização")) as unknown as { access_token: string; refresh_token: string; expire_in: number };
  return { accessToken: d.access_token, refreshToken: d.refresh_token, expiraEm: new Date(Date.now() + d.expire_in * 1000).toISOString(), contaId: shopId };
}

async function chamar(canal: Canal, metodo: "GET" | "POST", caminho: string, params: Record<string, string> = {}, corpo?: unknown) {
  const cred = await tokenValido(canal, shopee.renovar);
  const ts = agora();
  const q = new URLSearchParams({
    partner_id: String(parceiro()),
    timestamp: String(ts),
    access_token: cred.accessToken,
    shop_id: cred.contaId,
    sign: assinar(`${parceiro()}${caminho}${ts}${cred.accessToken}${cred.contaId}`),
    ...params,
  });
  const r = await fetch(`${host()}${caminho}?${q}`, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  return ler(r, caminho.replace("/api/v2/", ""));
}

const PAGO = new Set(["READY_TO_SHIP", "PROCESSED", "SHIPPED", "TO_CONFIRM_RECEIVE", "COMPLETED", "RETRY_SHIP"]);

export const shopee: Conector = {
  trocarCodigo(codigo, extra) {
    if (!extra.shop_id) throw new ErroCanal("A Shopee não devolveu o número da loja.");
    return tokenPublico("/api/v2/auth/token/get", { code: codigo }, extra.shop_id);
  },

  async renovar(cred) {
    const nova = await tokenPublico("/api/v2/auth/access_token/get", { refresh_token: cred.refreshToken }, cred.contaId);
    return { ...nova, contaNome: cred.contaNome };
  },

  async atualizarAnuncio(canal, anuncio, { estoque, precoCentavos }) {
    const item = Number(anuncio.externoId);
    const modelo = Number(anuncio.externoVarianteId || 0);
    await chamar(canal, "POST", "/api/v2/product/update_stock", {}, { item_id: item, stock_list: [{ model_id: modelo, seller_stock: [{ stock: estoque }] }] });
    if (precoCentavos != null) {
      await chamar(canal, "POST", "/api/v2/product/update_price", {}, { item_id: item, price_list: [{ model_id: modelo, original_price: precoCentavos / 100 }] });
    }
  },

  async lerAnuncio(canal, id) {
    const base = (await chamar(canal, "GET", "/api/v2/product/get_item_base_info", { item_id_list: id })) as {
      response?: { item_list?: { item_id: number; item_name: string; item_sku?: string; has_model?: boolean }[] };
    };
    const item = base.response?.item_list?.[0];
    if (!item) throw new ErroCanal(`Não achei o anúncio ${id} na Shopee.`);
    let variacoes: { id: string; nome: string; sku?: string | null }[] = [];
    if (item.has_model) {
      const m = (await chamar(canal, "GET", "/api/v2/product/get_model_list", { item_id: id })) as {
        response?: { model?: { model_id: number; model_sku?: string; model_name?: string; tier_index?: number[] }[]; tier_variation?: { option_list?: { option: string }[] }[] };
      };
      const opcoes = m.response?.tier_variation?.[0]?.option_list ?? [];
      variacoes = (m.response?.model ?? []).map((x) => ({
        id: String(x.model_id),
        nome: x.model_name || opcoes[x.tier_index?.[0] ?? -1]?.option || String(x.model_id),
        sku: x.model_sku ?? null,
      }));
    }
    return { id: String(item.item_id), titulo: item.item_name, variacoes };
  },

  async buscarPedido(canal, id) {
    const d = (await chamar(canal, "GET", "/api/v2/order/get_order_detail", {
      order_sn_list: id,
      response_optional_fields: "buyer_username,item_list,recipient_address",
    })) as {
      response?: {
        order_list?: {
          order_sn: string;
          order_status: string;
          buyer_username?: string;
          recipient_address?: { name?: string; phone?: string; full_address?: string };
          item_list: {
            item_id: number;
            model_id?: number;
            item_name: string;
            model_name?: string;
            item_sku?: string;
            model_sku?: string;
            model_quantity_purchased: number;
            model_discounted_price: number;
          }[];
        }[];
      };
    };
    const o = d.response?.order_list?.[0];
    if (!o) throw new ErroCanal(`Pedido ${id} não encontrado na Shopee.`);
    return {
      id: o.order_sn,
      status: o.order_status === "CANCELLED" ? "cancelado" : PAGO.has(o.order_status) ? "pago" : "pendente",
      comprador: { nome: o.recipient_address?.name || o.buyer_username || "Cliente Shopee", telefone: o.recipient_address?.phone ?? null },
      itens: o.item_list.map((i) => ({
        externoId: String(i.item_id),
        externoVarianteId: i.model_id ? String(i.model_id) : "",
        sku: i.model_sku || i.item_sku || null,
        titulo: i.model_name ? `${i.item_name} (${i.model_name})` : i.item_name,
        quantidade: i.model_quantity_purchased,
        precoUnitCentavos: centavosDeReais(i.model_discounted_price),
      })),
      endereco: o.recipient_address?.full_address ? `Envio pela Shopee: ${o.recipient_address.full_address}` : "Envio pela Shopee",
    };
  },

  async pedidosRecentes(canal) {
    const fim = agora();
    const d = (await chamar(canal, "GET", "/api/v2/order/get_order_list", {
      time_range_field: "update_time",
      time_from: String(fim - 2 * 86400),
      time_to: String(fim),
      page_size: "50",
    })) as { response?: { order_list?: { order_sn: string }[] } };
    return (d.response?.order_list ?? []).map((o) => o.order_sn);
  },
};
