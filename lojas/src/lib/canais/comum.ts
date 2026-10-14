import { eq } from "drizzle-orm";
import { db } from "@/db";
import { canais, type Anuncio, type Canal, type CredenciaisCanal, type Marketplace } from "@/db/schema";

/** erro vindo do marketplace, com a mensagem que ele deu */
export class ErroCanal extends Error {}

/** pedido do marketplace já no formato da loja */
export type PedidoExterno = {
  id: string;
  status: "pago" | "pendente" | "cancelado";
  comprador: { nome: string; email?: string | null; telefone?: string | null; documento?: string | null };
  itens: {
    externoId: string;
    externoVarianteId: string;
    sku?: string | null;
    titulo: string;
    quantidade: number;
    precoUnitCentavos: number;
  }[];
  endereco?: string;
};

export type AnuncioExterno = {
  id: string;
  titulo: string;
  link?: string;
  variacoes: { id: string; nome: string; sku?: string | null }[];
};

export type Conector = {
  /** troca o código da autorização pelas credenciais */
  trocarCodigo(codigo: string, extra: Record<string, string>): Promise<CredenciaisCanal>;
  renovar(cred: CredenciaisCanal): Promise<CredenciaisCanal>;
  atualizarAnuncio(canal: Canal, anuncio: Anuncio, valores: { estoque: number; precoCentavos: number | null }): Promise<void>;
  lerAnuncio(canal: Canal, id: string): Promise<AnuncioExterno>;
  buscarPedido(canal: Canal, id: string): Promise<PedidoExterno>;
  pedidosRecentes(canal: Canal): Promise<string[]>;
};

export const NOMES_MARKETPLACE: Record<Marketplace, string> = { mercadolivre: "Mercado Livre", shopee: "Shopee" };

/** devolve um access token válido, renovando com trava no banco para não renovar duas vezes ao mesmo tempo */
export async function tokenValido(canal: Canal, renovar: Conector["renovar"]): Promise<CredenciaisCanal> {
  const cred = canal.credenciais;
  if (!cred) throw new ErroCanal(`${NOMES_MARKETPLACE[canal.tipo]} não está conectado.`);
  if (new Date(cred.expiraEm).getTime() - Date.now() > 5 * 60_000) return cred;
  return db.transaction(async (tx) => {
    const [atual] = await tx.select().from(canais).where(eq(canais.id, canal.id)).for("update");
    const c = atual.credenciais!;
    if (new Date(c.expiraEm).getTime() - Date.now() > 5 * 60_000) return c;
    const nova = await renovar(c);
    await tx.update(canais).set({ credenciais: nova, ultimoErro: null }).where(eq(canais.id, canal.id));
    canal.credenciais = nova;
    return nova;
  });
}

export function centavosDeReais(valor: number | string | null | undefined): number {
  return Math.round(Number(valor ?? 0) * 100);
}
