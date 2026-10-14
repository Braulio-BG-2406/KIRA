import { notFound } from "next/navigation";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { canais, produtos, type Marketplace } from "@/db/schema";
import { contexto } from "@/lib/painel";
import { urlPublica } from "@/lib/mercadopago";
import { mlConfigurado } from "@/lib/canais/mercadolivre";
import { shopeeConfigurado } from "@/lib/canais/shopee";
import { anunciosDoCanal } from "@/lib/canais/sincronizar";
import { opcoesDeVariantes } from "@/lib/opcoes";
import { formatarDataHora } from "@/lib/datas";
import { Aviso, Cabecalho, Cartao, Tabela, Vazio } from "@/components/admin/ui";
import { Confirmar, Enviar } from "@/components/admin/Botoes";
import { acaoConfigCanal, acaoDesconectar, acaoDesvincular, acaoPublicarML, acaoSincronizarAgora, acaoVincular } from "../acoes";

const NOMES: Record<Marketplace, string> = { mercadolivre: "Mercado Livre", shopee: "Shopee" };

export default async function Marketplace({ params, searchParams }: { params: Promise<{ tipo: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { loja } = await contexto();
  const { tipo } = await params;
  if (tipo !== "mercadolivre" && tipo !== "shopee") notFound();
  const sp = await searchParams;
  const ml = tipo === "mercadolivre";
  const configurado = ml ? mlConfigurado() : shopeeConfigurado();
  const [canal] = await db.select().from(canais).where(and(eq(canais.lojaId, loja.id), eq(canais.tipo, tipo)));
  const conectado = !!(canal?.credenciais && canal.ativo);
  const lista = canal ? await anunciosDoCanal(canal.id) : [];
  const [opcoes, todos] = conectado
    ? await Promise.all([opcoesDeVariantes(loja.id), db.select({ id: produtos.id, nome: produtos.nome }).from(produtos).where(and(eq(produtos.lojaId, loja.id), eq(produtos.ativo, true))).orderBy(produtos.nome)])
    : [[], []];
  const retorno = `${urlPublica()}/api/canais/${tipo}/retorno`;
  const avisos = `${urlPublica()}/api/canais/${tipo}/notificacoes`;

  return (
    <>
      <Cabecalho titulo={NOMES[tipo]} voltar="/admin/canais">
        {conectado && (
          <form action={acaoSincronizarAgora}>
            <input type="hidden" name="tipo" value={tipo} />
            <Enviar className="botao-secundario" pendente="Sincronizando…">Sincronizar agora</Enviar>
          </form>
        )}
      </Cabecalho>
      <Aviso ok={sp.ok} erro={sp.erro} />

      {!configurado && (
        <Cartao titulo="Primeiro passo (uma vez só, para as duas lojas)">
          {ml ? (
            <ol className="list-decimal space-y-2 pl-5 text-sm text-stone-700">
              <li>Entre em <a className="underline" href="https://developers.mercadolivre.com.br/devcenter" target="_blank" rel="noopener">developers.mercadolivre.com.br</a> com a conta do ML e crie um aplicativo.</li>
              <li>URI de redirect: <code className="break-all text-xs">{retorno}</code></li>
              <li>Notificações: URL <code className="break-all text-xs">{avisos}</code> e marque o tópico <b>orders_v2</b>.</li>
              <li>Coloque o <b>App ID</b> e a <b>Secret Key</b> no servidor, em <code>ML_CLIENT_ID</code> e <code>ML_CLIENT_SECRET</code>, e reinicie.</li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 text-sm text-stone-700">
              <li>Cadastre-se em <a className="underline" href="https://open.shopee.com" target="_blank" rel="noopener">open.shopee.com</a> como vendedor com sistema próprio e crie um app. A Shopee analisa e aprova (leva alguns dias).</li>
              <li>Redirect URL: <code className="break-all text-xs">{retorno}</code></li>
              <li>Push Mechanism: URL <code className="break-all text-xs">{avisos}</code> com o aviso de status de pedido.</li>
              <li>Coloque o <b>Partner ID</b> e a <b>Partner Key</b> no servidor, em <code>SHOPEE_PARTNER_ID</code> e <code>SHOPEE_PARTNER_KEY</code>, e reinicie.</li>
            </ol>
          )}
        </Cartao>
      )}

      {configurado && !conectado && (
        <Cartao>
          <p className="text-sm text-stone-700">Conecte a conta {ml ? "do Mercado Livre" : "da Shopee"} da {loja.nome}. Você vai entrar no site deles e autorizar.</p>
          <a href={`/api/canais/${tipo}/conectar`} className="botao-primario mt-4">
            Conectar {NOMES[tipo]}
          </a>
        </Cartao>
      )}

      {conectado && canal && (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <Cartao titulo={`Anúncios ligados à loja (${lista.length})`}>
              {canal.ultimoErro && <p className="mb-3 rounded bg-amber-50 p-2 text-xs text-amber-800">{canal.ultimoErro}</p>}
              {lista.length === 0 ? (
                <Vazio>Nenhum anúncio ligado ainda. {ml ? "Publique um produto ou vincule" : "Vincule"} um anúncio que já existe.</Vazio>
              ) : (
                <Tabela>
                  <thead>
                    <tr><th>Produto</th><th>Anúncio</th><th className="text-right">Estoque loja</th><th className="text-right">Enviado</th><th>Situação</th><th></th></tr>
                  </thead>
                  <tbody>
                    {lista.map(({ a, produtoNome, varianteNome, produtoId, estoque }) => (
                      <tr key={a.id}>
                        <td>
                          <Link href={`/admin/produtos/${produtoId}`} className="hover:underline">{produtoNome}</Link>
                          {varianteNome !== "Padrão" && <span className="text-stone-500"> · {varianteNome}</span>}
                        </td>
                        <td className="font-mono text-xs">
                          {a.link ? <a href={a.link} target="_blank" rel="noopener" className="underline">{a.externoId}</a> : a.externoId}
                          {a.externoVarianteId && <span className="text-stone-400"> / {a.externoVarianteId}</span>}
                        </td>
                        <td className="text-right tabular-nums">{estoque}</td>
                        <td className="text-right tabular-nums">{a.ultimoEstoqueEnviado ?? "—"}</td>
                        <td className="text-xs">{a.erro ? <span className="text-red-600">{a.erro}</span> : a.sincronizadoEm ? <span className="text-green-700">ok {formatarDataHora(a.sincronizadoEm)}</span> : "aguardando"}</td>
                        <td>
                          <form action={acaoDesvincular}>
                            <input type="hidden" name="tipo" value={tipo} />
                            <input type="hidden" name="anuncioId" value={a.id} />
                            <Confirmar pergunta="Desligar este anúncio da loja?" className="text-xs text-red-600 underline">desligar</Confirmar>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Tabela>
              )}
            </Cartao>

            {ml && (
              <Cartao titulo="Publicar produto no Mercado Livre">
                <form action={acaoPublicarML} className="flex flex-wrap gap-2">
                  <select name="produtoId" className="campo flex-1" required defaultValue="">
                    <option value="" disabled>Escolha o produto</option>
                    {todos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                  <Enviar pendente="Publicando…">Publicar</Enviar>
                </form>
                <p className="mt-2 text-xs text-stone-500">
                  Vai com as fotos, a descrição, a ficha técnica, a marca e o código de barras. Cada variação vira um anúncio. Se o ML pedir algum dado da categoria, o erro aparece aqui e dá para completar no próprio ML e vincular.
                </p>
              </Cartao>
            )}

            <Cartao titulo="Vincular anúncio que já existe">
              <form action={acaoVincular} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="tipo" value={tipo} />
                <label className="block sm:col-span-2">
                  <span className="rotulo">Produto da loja</span>
                  <select name="varianteId" className="campo" required defaultValue="">
                    <option value="" disabled>Escolha</option>
                    {opcoes.map((o) => <option key={o.id} value={o.id}>{o.nome}{o.sku ? ` (${o.sku})` : ""}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="rotulo">{ml ? "Código (MLB...) ou link do anúncio" : "Número ou link do anúncio"}</span>
                  <input name="anuncio" required className="campo" />
                </label>
                <label className="block">
                  <span className="rotulo">Variação no anúncio (se tiver)</span>
                  <input name="variacao" placeholder="acho sozinho pelo SKU ou nome" className="campo" />
                </label>
                <div className="sm:col-span-2"><Enviar className="botao-secundario">Vincular</Enviar></div>
              </form>
              <p className="mt-2 text-xs text-stone-500">Dica: com o mesmo SKU na loja e no anúncio, as vendas já caem certas mesmo sem vincular. Mas o estoque só é enviado para anúncio vinculado.</p>
            </Cartao>
          </div>

          <div className="space-y-6">
            <Cartao titulo="Conta">
              <p className="text-sm">{canal.credenciais?.contaNome ?? `Conta ${canal.credenciais?.contaId}`}</p>
              <p className="mt-1 text-xs text-stone-500">Última sincronização: {formatarDataHora(canal.sincronizadoEm)}</p>
              <form action={acaoDesconectar} className="mt-3">
                <input type="hidden" name="tipo" value={tipo} />
                <Confirmar pergunta="Desconectar a conta?" className="botao-perigo w-full">Desconectar</Confirmar>
              </form>
            </Cartao>
            <Cartao titulo="Preço no marketplace">
              <form action={acaoConfigCanal} className="space-y-3">
                <input type="hidden" name="tipo" value={tipo} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="sincronizarPreco" defaultChecked={canal.config.sincronizarPreco} /> Usar o preço da loja
                </label>
                <label className="block">
                  <span className="rotulo">Acréscimo para cobrir a comissão (%)</span>
                  <input name="acrescimoPct" type="number" min={0} max={100} defaultValue={canal.config.acrescimoPct} className="campo" />
                </label>
                {ml && (
                  <label className="block">
                    <span className="rotulo">Tipo de anúncio novo</span>
                    <select name="tipoAnuncio" defaultValue={canal.config.tipoAnuncio ?? "gold_special"} className="campo">
                      <option value="gold_special">Clássico</option>
                      <option value="gold_pro">Premium (parcelado sem juros)</option>
                    </select>
                  </label>
                )}
                <Enviar className="botao-secundario w-full">Salvar</Enviar>
              </form>
              <p className="mt-2 text-xs text-stone-500">Desmarcado, o preço fica como você puser lá; só o estoque é sincronizado.</p>
            </Cartao>
          </div>
        </div>
      )}
    </>
  );
}
