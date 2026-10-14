"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { anuncios, canais, lojas, produtoImagens, produtos, variantes, type Canal, type Marketplace } from "@/db/schema";
import { contexto, executar, inteiro, marcado, texto } from "@/lib/painel";
import { ErroNegocio } from "@/lib/erros";
import { absoluta } from "@/lib/dominios";
import { CONECTORES, sincronizarCanal, varrerPedidos, vincularAnuncio } from "@/lib/canais/sincronizar";
import { ErroCanal } from "@/lib/canais/comum";
import { mlPublicar } from "@/lib/canais/mercadolivre";

function tipoValido(t: string): Marketplace {
  if (t !== "mercadolivre" && t !== "shopee") throw new ErroNegocio("Canal inválido.");
  return t;
}

async function canalConectado(lojaId: number, tipo: Marketplace): Promise<Canal> {
  const [c] = await db.select().from(canais).where(and(eq(canais.lojaId, lojaId), eq(canais.tipo, tipo)));
  if (!c?.credenciais || !c.ativo) throw new ErroNegocio("Conecte a conta primeiro.");
  return c;
}

/** erros do marketplace aparecem na tela como aviso */
async function comCanal<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ErroCanal) throw new ErroNegocio(e.message);
    throw e;
  }
}

export async function acaoRastreamento(fd: FormData) {
  const { loja } = await contexto();
  await executar("/admin/canais", async () => {
    const atual = loja.rastreamento ?? {};
    const campos = ["googleVerificacao", "googleAnalytics", "metaVerificacao", "metaPixel"] as const;
    const novo = { ...atual };
    for (const c of campos) if (fd.has(c)) novo[c] = texto(fd, c) || undefined;
    // a meta tag do Google costuma ser colada inteira: guarda só o código
    for (const c of ["googleVerificacao", "metaVerificacao"] as const) {
      const m = novo[c]?.match(/content=["']([^"']+)["']/);
      if (m) novo[c] = m[1];
    }
    await db.update(lojas).set({ rastreamento: novo }).where(eq(lojas.id, loja.id));
  }, "Códigos salvos.");
}

export async function acaoConfigCanal(fd: FormData) {
  const { loja } = await contexto();
  const tipo = tipoValido(texto(fd, "tipo"));
  await executar(`/admin/canais/${tipo}`, async () => {
    const canal = await canalConectado(loja.id, tipo);
    const tipoAnuncio = texto(fd, "tipoAnuncio") === "gold_pro" ? "gold_pro" : "gold_special";
    await db
      .update(canais)
      .set({ config: { sincronizarPreco: marcado(fd, "sincronizarPreco"), acrescimoPct: Math.min(100, Math.max(0, inteiro(fd, "acrescimoPct"))), tipoAnuncio } })
      .where(eq(canais.id, canal.id));
    // força reenviar os preços com a regra nova
    await db.update(anuncios).set({ ultimoPrecoEnviado: null }).where(eq(anuncios.canalId, canal.id));
  }, "Configuração salva. Os preços vão ser reenviados.");
}

/** aceita o código (MLB123..., 123...) ou o link do anúncio */
function lerCodigoAnuncio(tipo: Marketplace, entrada: string): string {
  const t = entrada.trim();
  if (tipo === "mercadolivre") {
    const m = t.toUpperCase().replace(/-/g, "").match(/MLB\d{6,}/);
    if (!m) throw new ErroNegocio("Não achei o código do anúncio (começa com MLB).");
    return m[0];
  }
  const link = t.match(/i\.(\d+)\.(\d+)/);
  if (link) return link[2];
  if (/^\d{5,}$/.test(t)) return t;
  throw new ErroNegocio("Informe o número do anúncio da Shopee ou o link dele.");
}

export async function acaoVincular(fd: FormData) {
  const { loja } = await contexto();
  const tipo = tipoValido(texto(fd, "tipo"));
  await executar(`/admin/canais/${tipo}`, () =>
    comCanal(async () => {
      const canal = await canalConectado(loja.id, tipo);
      const varianteId = inteiro(fd, "varianteId");
      const id = lerCodigoAnuncio(tipo, texto(fd, "anuncio"));
      const anuncio = await CONECTORES[tipo].lerAnuncio(canal, id);
      let variacao = texto(fd, "variacao");
      if (anuncio.variacoes.length > 0 && !variacao) {
        // tenta casar pela variação da loja (SKU ou nome)
        const [v] = await db.select().from(variantes).where(eq(variantes.id, varianteId));
        const achada = anuncio.variacoes.find((x) => (v?.sku && x.sku === v.sku) || x.nome.toLowerCase() === v?.nome.toLowerCase());
        if (!achada) {
          throw new ErroNegocio(`Esse anúncio tem variações. Escolha qual: ${anuncio.variacoes.map((x) => `${x.nome} (${x.id})`).join(", ")}.`);
        }
        variacao = achada.id;
      }
      if (variacao && !anuncio.variacoes.some((x) => x.id === variacao)) throw new ErroNegocio("Essa variação não existe no anúncio.");
      await vincularAnuncio(canal, varianteId, anuncio.id, variacao, anuncio.link);
    }),
  "Anúncio vinculado. O estoque da loja passa a valer lá.");
}

export async function acaoPublicarML(fd: FormData) {
  const { loja } = await contexto();
  await executar("/admin/canais/mercadolivre", () =>
    comCanal(async () => {
      const canal = await canalConectado(loja.id, "mercadolivre");
      const produtoId = inteiro(fd, "produtoId");
      const [p] = await db.select().from(produtos).where(and(eq(produtos.id, produtoId), eq(produtos.lojaId, loja.id)));
      if (!p) throw new ErroNegocio("Produto não encontrado.");
      const vs = await db.select().from(variantes).where(and(eq(variantes.produtoId, produtoId), eq(variantes.ativo, true))).orderBy(asc(variantes.ordem));
      const imgs = await db.select().from(produtoImagens).where(eq(produtoImagens.produtoId, produtoId)).orderBy(asc(produtoImagens.ordem));
      const jaPublicadas = new Set(
        (await db.select({ id: anuncios.varianteId }).from(anuncios).where(and(eq(anuncios.canalId, canal.id), inArray(anuncios.varianteId, vs.map((v) => v.id).concat(0))))).map((a) => a.id),
      );
      const descricao = [p.descricao, ...p.especificacoes.map((e) => `${e.nome}: ${e.valor}`), p.itensInclusos ? `Vem com: ${p.itensInclusos}` : ""].filter(Boolean).join("\n");
      let publicados = 0;
      // cada variação vira um anúncio (o título leva o nome da variação)
      for (const v of vs) {
        if (jaPublicadas.has(v.id) || v.estoque < 1) continue;
        const preco = canal.config.sincronizarPreco ? Math.round(v.precoCentavos * (1 + canal.config.acrescimoPct / 100)) : v.precoCentavos;
        const r = await mlPublicar(canal, {
          titulo: vs.length > 1 ? `${p.nome} ${v.nome}` : p.nome,
          descricao: descricao || p.nome,
          precoCentavos: preco,
          estoque: v.estoque,
          imagens: imgs.map((i) => absoluta(i.url)),
          marca: p.marca,
          modelo: p.nome,
          sku: v.sku,
          codigoBarras: v.codigoBarras,
          garantia: p.garantia,
        });
        await vincularAnuncio(canal, v.id, r.id, "", r.link);
        await db.update(anuncios).set({ ultimoEstoqueEnviado: v.estoque, ultimoPrecoEnviado: preco }).where(and(eq(anuncios.canalId, canal.id), eq(anuncios.varianteId, v.id)));
        publicados++;
      }
      if (publicados === 0) throw new ErroNegocio("Nada para publicar: as variações já estão no ML ou estão sem estoque.");
    }),
  "Publicado no Mercado Livre.");
}

export async function acaoDesvincular(fd: FormData) {
  const { loja } = await contexto();
  const tipo = tipoValido(texto(fd, "tipo"));
  await executar(`/admin/canais/${tipo}`, async () => {
    const canal = await canalConectado(loja.id, tipo);
    await db.delete(anuncios).where(and(eq(anuncios.id, inteiro(fd, "anuncioId")), eq(anuncios.canalId, canal.id)));
  }, "Vínculo removido. O anúncio continua no marketplace, mas sem receber o estoque da loja.");
}

export async function acaoSincronizarAgora(fd: FormData) {
  const { loja } = await contexto();
  const tipo = tipoValido(texto(fd, "tipo"));
  await executar(`/admin/canais/${tipo}`, () =>
    comCanal(async () => {
      const canal = await canalConectado(loja.id, tipo);
      const novos = await varrerPedidos(canal);
      const r = await sincronizarCanal(canal, true);
      await db.update(canais).set({ ultimoErro: null }).where(eq(canais.id, canal.id));
      return { ok: `Sincronizado: ${r.enviados} anúncio(s) atualizado(s), ${r.erros} com erro, ${novos} pedido(s) novo(s).` };
    }),
  );
}

export async function acaoDesconectar(fd: FormData) {
  const { loja } = await contexto();
  const tipo = tipoValido(texto(fd, "tipo"));
  await executar(`/admin/canais/${tipo}`, async () => {
    await db.update(canais).set({ credenciais: null, ativo: false }).where(and(eq(canais.lojaId, loja.id), eq(canais.tipo, tipo)));
  }, "Conta desconectada. Os vínculos ficam guardados para quando conectar de novo.");
}
