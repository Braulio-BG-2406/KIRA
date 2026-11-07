import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { anuncios, canais, pedidos, produtos, variantes, type Canal, type Marketplace } from "@/db/schema";
import { cancelarPedido, criarPedido } from "../pedidos";
import { ErroCanal, NOMES_MARKETPLACE, type Conector, type PedidoExterno } from "./comum";
import { mercadoLivre } from "./mercadolivre";
import { shopee } from "./shopee";

export const CONECTORES: Record<Marketplace, Conector> = { mercadolivre: mercadoLivre, shopee };

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);

/** estoque e preço que o anúncio deve ter agora */
function alvo(canal: Canal, v: { estoque: number; precoCentavos: number; ativo: boolean }, produtoAtivo: boolean) {
  const estoque = produtoAtivo && v.ativo ? Math.max(0, v.estoque) : 0;
  const preco = canal.config.sincronizarPreco ? Math.round(v.precoCentavos * (1 + (canal.config.acrescimoPct || 0) / 100)) : null;
  return { estoque, preco };
}

/** manda para o marketplace só o que mudou desde o último envio */
export async function sincronizarCanal(canal: Canal, forcar = false): Promise<{ enviados: number; erros: number }> {
  const conector = CONECTORES[canal.tipo];
  const lista = await db
    .select({ a: anuncios, v: variantes, produtoAtivo: produtos.ativo })
    .from(anuncios)
    .innerJoin(variantes, eq(variantes.id, anuncios.varianteId))
    .innerJoin(produtos, eq(produtos.id, variantes.produtoId))
    .where(eq(anuncios.canalId, canal.id));
  let enviados = 0;
  let erros = 0;
  for (const { a, v, produtoAtivo } of lista) {
    const { estoque, preco } = alvo(canal, v, produtoAtivo);
    const mudou = forcar || a.erro || estoque !== a.ultimoEstoqueEnviado || (preco != null && preco !== a.ultimoPrecoEnviado);
    if (!mudou) continue;
    try {
      await conector.atualizarAnuncio(canal, a, { estoque, precoCentavos: preco });
      await db
        .update(anuncios)
        .set({ ultimoEstoqueEnviado: estoque, ultimoPrecoEnviado: preco ?? a.ultimoPrecoEnviado, erro: null, sincronizadoEm: new Date() })
        .where(eq(anuncios.id, a.id));
      enviados++;
    } catch (e) {
      await db.update(anuncios).set({ erro: mensagem(e) }).where(eq(anuncios.id, a.id));
      erros++;
    }
  }
  await db.update(canais).set({ sincronizadoEm: new Date() }).where(eq(canais.id, canal.id));
  return { enviados, erros };
}

/** acha a variação da loja para um item do pedido: pelo anúncio vinculado, senão pelo SKU */
async function varianteDoItem(canal: Canal, item: PedidoExterno["itens"][number]): Promise<number | null> {
  const vinculos = await db
    .select({ varianteId: anuncios.varianteId, externoVarianteId: anuncios.externoVarianteId })
    .from(anuncios)
    .where(and(eq(anuncios.canalId, canal.id), eq(anuncios.externoId, item.externoId)));
  const exato = vinculos.find((x) => x.externoVarianteId === item.externoVarianteId) ?? (vinculos.length === 1 ? vinculos[0] : undefined);
  if (exato) return exato.varianteId;
  if (item.sku) {
    const [porSku] = await db
      .select({ id: variantes.id })
      .from(variantes)
      .innerJoin(produtos, eq(produtos.id, variantes.produtoId))
      .where(and(eq(produtos.lojaId, canal.lojaId), eq(variantes.sku, item.sku)));
    if (porSku) return porSku.id;
  }
  return null;
}

/**
 * Registra (ou cancela) na loja o pedido que veio do marketplace.
 * Pode ser chamado várias vezes com o mesmo pedido: só cria uma vez.
 */
export async function importarPedido(canal: Canal, pe: PedidoExterno): Promise<"criado" | "cancelado" | "ignorado"> {
  const [existente] = await db
    .select()
    .from(pedidos)
    .where(and(eq(pedidos.lojaId, canal.lojaId), eq(pedidos.canal, canal.tipo), eq(pedidos.canalPedidoId, pe.id)));
  if (pe.status === "cancelado") {
    if (existente && existente.status !== "cancelado" && existente.status !== "entregue") {
      await cancelarPedido(existente.id, `Cancelado no ${NOMES_MARKETPLACE[canal.tipo]}`);
      return "cancelado";
    }
    return "ignorado";
  }
  if (pe.status !== "pago" || existente) return "ignorado";

  const itens = [];
  const semVinculo = [];
  for (const i of pe.itens) {
    const varianteId = await varianteDoItem(canal, i);
    if (varianteId) itens.push({ varianteId, quantidade: i.quantidade, precoUnitCentavos: i.precoUnitCentavos });
    else semVinculo.push(i.titulo);
  }
  if (semVinculo.length) {
    await db
      .update(canais)
      .set({ ultimoErro: `Pedido ${pe.id}: produto sem vínculo na loja (${semVinculo.join(", ")}). Vincule o anúncio ou use o mesmo SKU.` })
      .where(eq(canais.id, canal.id));
  }
  if (itens.length === 0) return "ignorado";
  try {
    await criarPedido({
      lojaId: canal.lojaId,
      canal: canal.tipo,
      canalPedidoId: pe.id,
      formaPagamento: "marketplace",
      jaPago: true,
      permitirSemEstoque: true,
      cliente: pe.comprador,
      itens,
      freteManualCentavos: 0,
      entrega: { metodo: "entrega", descricao: `Envio pelo ${NOMES_MARKETPLACE[canal.tipo]}`, enderecoTexto: pe.endereco },
      observacoes: semVinculo.length ? `Itens não vinculados (não baixaram estoque): ${semVinculo.join(", ")}` : null,
    });
  } catch (e) {
    // aviso repetido chegando ao mesmo tempo: o índice único segura e o pedido já existe
    if ((e as { cause?: { code?: string } }).cause?.code === "23505") return "ignorado";
    throw e;
  }
  return "criado";
}

/** busca no marketplace e registra um pedido avisado por webhook */
export async function receberAvisoDePedido(canal: Canal, pedidoId: string) {
  const pe = await CONECTORES[canal.tipo].buscarPedido(canal, pedidoId);
  const r = await importarPedido(canal, pe);
  if (r !== "ignorado") await sincronizarTudo();
  return r;
}

/** rede de segurança: confere os pedidos recentes, caso algum aviso tenha se perdido */
export async function varrerPedidos(canal: Canal) {
  let novos = 0;
  for (const id of await CONECTORES[canal.tipo].pedidosRecentes(canal)) {
    const pe = await CONECTORES[canal.tipo].buscarPedido(canal, id);
    if ((await importarPedido(canal, pe)) !== "ignorado") novos++;
  }
  return novos;
}

export async function canaisAtivos(lojaId?: number) {
  const filtros = [eq(canais.ativo, true), sql`${canais.credenciais} is not null`];
  if (lojaId) filtros.push(eq(canais.lojaId, lojaId));
  return db.select().from(canais).where(and(...filtros));
}

let rodando: Promise<void> | null = null;
let deNovo = false;

/** sincroniza o estoque de todas as lojas; se já estiver rodando, roda de novo no fim */
export async function sincronizarTudo(): Promise<void> {
  if (rodando) {
    deNovo = true;
    return rodando;
  }
  rodando = (async () => {
    do {
      deNovo = false;
      for (const canal of await canaisAtivos()) {
        try {
          await sincronizarCanal(canal);
        } catch (e) {
          await db.update(canais).set({ ultimoErro: mensagem(e) }).where(eq(canais.id, canal.id));
        }
      }
    } while (deNovo);
  })().finally(() => {
    rodando = null;
  });
  return rodando;
}

/** manutenção periódica (Kira/n8n): varre pedidos e sincroniza estoque */
export async function manutencaoDosCanais() {
  const resumo: Record<string, number | string> = {};
  for (const canal of await canaisAtivos()) {
    try {
      resumo[`${canal.tipo}:${canal.lojaId}`] = await varrerPedidos(canal);
    } catch (e) {
      resumo[`${canal.tipo}:${canal.lojaId}`] = mensagem(e);
      await db.update(canais).set({ ultimoErro: mensagem(e) }).where(eq(canais.id, canal.id));
    }
  }
  await sincronizarTudo();
  return resumo;
}

/** liga uma variação a um anúncio que já existe no marketplace */
export async function vincularAnuncio(canal: Canal, varianteId: number, externoId: string, externoVarianteId = "", link?: string | null) {
  const [v] = await db
    .select({ id: variantes.id })
    .from(variantes)
    .innerJoin(produtos, eq(produtos.id, variantes.produtoId))
    .where(and(eq(variantes.id, varianteId), eq(produtos.lojaId, canal.lojaId)));
  if (!v) throw new ErroCanal("Produto não encontrado nesta loja.");
  await db
    .insert(anuncios)
    .values({ canalId: canal.id, varianteId, externoId: externoId.trim(), externoVarianteId: externoVarianteId.trim(), link: link ?? null })
    .onConflictDoUpdate({
      target: [anuncios.canalId, anuncios.varianteId],
      set: { externoId: externoId.trim(), externoVarianteId: externoVarianteId.trim(), link: link ?? null, erro: null, ultimoEstoqueEnviado: null, ultimoPrecoEnviado: null },
    });
}

export async function anunciosDoCanal(canalId: number) {
  return db
    .select({ a: anuncios, varianteNome: variantes.nome, produtoNome: produtos.nome, produtoId: produtos.id, estoque: variantes.estoque })
    .from(anuncios)
    .innerJoin(variantes, eq(variantes.id, anuncios.varianteId))
    .innerJoin(produtos, eq(produtos.id, variantes.produtoId))
    .where(eq(anuncios.canalId, canalId));
}

