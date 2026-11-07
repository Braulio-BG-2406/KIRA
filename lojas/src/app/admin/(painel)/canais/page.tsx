import Link from "next/link";
import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { anuncios, canais, produtoImagens, produtos, type Marketplace } from "@/db/schema";
import { contexto } from "@/lib/painel";
import { urlDaLoja } from "@/lib/dominios";
import { mlConfigurado } from "@/lib/canais/mercadolivre";
import { shopeeConfigurado } from "@/lib/canais/shopee";
import { rastreamentoSeguro } from "@/lib/rastreamento";
import { marcasDeTerceiros, textosDoProduto } from "@/lib/marcas";
import { formatarDataHora } from "@/lib/datas";
import { Aviso, Cabecalho, Cartao } from "@/components/admin/ui";
import { Enviar } from "@/components/admin/Botoes";
import { Copiar } from "@/components/loja/Copiar";
import { acaoRastreamento } from "./acoes";

function Passos({ itens }: { itens: React.ReactNode[] }) {
  return (
    <ol className="list-decimal space-y-1 pl-5 text-sm text-stone-600">
      {itens.map((i, n) => (
        <li key={n}>{i}</li>
      ))}
    </ol>
  );
}

function Endereco({ rotulo, url }: { rotulo: string; url: string }) {
  return (
    <div>
      <span className="rotulo">{rotulo}</span>
      <div className="flex gap-2">
        <input readOnly value={url} className="campo font-mono text-xs" aria-label={rotulo} />
        <div className="w-28 shrink-0">
          <Copiar texto={url} rotulo="Copiar" />
        </div>
      </div>
    </div>
  );
}

export default async function Canais({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { loja } = await contexto();
  const sp = await searchParams;
  const base = urlDaLoja(loja.slug);
  const r = rastreamentoSeguro(loja.rastreamento);
  const ativos = await db.select().from(produtos).where(and(eq(produtos.lojaId, loja.id), eq(produtos.ativo, true)));
  const citamMarca = ativos.filter((p) => marcasDeTerceiros(...textosDoProduto(p)).length > 0).length;
  const comFoto = ativos.length
    ? (await db.selectDistinct({ id: produtoImagens.produtoId }).from(produtoImagens).where(inArray(produtoImagens.produtoId, ativos.map((a) => a.id)))).length
    : 0;
  const lista = await db.select().from(canais).where(eq(canais.lojaId, loja.id));
  const totais = await db.select({ canalId: anuncios.canalId, n: count() }).from(anuncios).groupBy(anuncios.canalId);
  const marketplace = (tipo: Marketplace) => {
    const c = lista.find((x) => x.tipo === tipo);
    const configurado = tipo === "mercadolivre" ? mlConfigurado() : shopeeConfigurado();
    return {
      c,
      configurado,
      conectado: !!(c?.credenciais && c.ativo),
      anuncios: totais.find((t) => t.canalId === c?.id)?.n ?? 0,
    };
  };

  return (
    <>
      <Cabecalho titulo="Canais de venda" />
      <p className="-mt-4 mb-5 text-sm text-stone-500">Onde a {loja.nome} aparece além do site. O estoque é um só: vendeu em um canal, baixa em todos.</p>
      <Aviso ok={sp.ok} erro={sp.erro} />

      <div className="grid gap-4 md:grid-cols-2">
        {(["mercadolivre", "shopee"] as const).map((tipo) => {
          const m = marketplace(tipo);
          return (
            <Cartao key={tipo} titulo={tipo === "mercadolivre" ? "Mercado Livre" : "Shopee"}>
              <p className="text-sm">
                {m.conectado ? (
                  <span className="text-green-700">Conectado{m.c?.credenciais?.contaNome ? ` como ${m.c.credenciais.contaNome}` : ""}</span>
                ) : m.configurado ? (
                  <span className="text-stone-600">Pronto para conectar a conta da loja.</span>
                ) : (
                  <span className="text-amber-700">Falta cadastrar o app {tipo === "mercadolivre" ? "no DevCenter do Mercado Livre" : "na Shopee Open Platform"}.</span>
                )}
              </p>
              {m.conectado && (
                <p className="mt-1 text-xs text-stone-500">
                  {m.anuncios} anúncio(s) ligados · última sincronização {formatarDataHora(m.c?.sincronizadoEm)}
                </p>
              )}
              {m.c?.ultimoErro && <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800">{m.c.ultimoErro}</p>}
              <Link href={`/admin/canais/${tipo}`} className="botao-secundario mt-4">
                {m.conectado ? "Gerenciar anúncios" : "Configurar"}
              </Link>
            </Cartao>
          );
        })}

        <Cartao titulo="Google (busca e Google Shopping)">
          <div className="space-y-4">
            <p className="text-sm text-stone-600">
              {comFoto} de {ativos.length} produto(s) à venda têm foto e entram no Google. Produto sem foto fica de fora.
              {citamMarca > 0 && <span className="mt-1 block text-amber-700">{citamMarca} produto(s) citam outra marca e ficam fora do feed até o nome sair.</span>}
            </p>
            <Endereco rotulo="Feed de produtos (Merchant Center)" url={`${base}/feed.xml`} />
            <Endereco rotulo="Mapa do site (Search Console)" url={`${base}/sitemap.xml`} />
            <Passos
              itens={[
                <>No <a className="underline" href="https://search.google.com/search-console" target="_blank" rel="noopener">Search Console</a>, adicione o domínio da loja, escolha &quot;Tag HTML&quot; e cole o código abaixo. Depois envie o mapa do site.</>,
                <>No <a className="underline" href="https://merchants.google.com" target="_blank" rel="noopener">Merchant Center</a>: Produtos → Fontes de dados → Adicionar → &quot;Buscar arquivo de um link&quot; → cole o endereço do feed (todo dia).</>,
                <>Os produtos aparecem de graça na aba Shopping. Para anúncio pago, ligue o Merchant Center ao Google Ads.</>,
              ]}
            />
            <form action={acaoRastreamento} className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="rotulo">Código de verificação do Search Console</span>
                <input name="googleVerificacao" defaultValue={r.googleVerificacao ?? ""} placeholder="cole a tag ou só o código" className="campo" />
              </label>
              <label className="block">
                <span className="rotulo">Google Analytics (G-...)</span>
                <input name="googleAnalytics" defaultValue={r.googleAnalytics ?? ""} placeholder="G-XXXXXXXXXX" className="campo" />
              </label>
              <div className="sm:col-span-2">
                <Enviar className="botao-secundario">Salvar códigos do Google</Enviar>
              </div>
            </form>
          </div>
        </Cartao>

        <Cartao titulo="Instagram e Facebook">
          <div className="space-y-4">
            <Endereco rotulo="Catálogo de produtos (Commerce Manager)" url={`${base}/feed.xml`} />
            <Passos
              itens={[
                <>No <a className="underline" href="https://business.facebook.com/commerce" target="_blank" rel="noopener">Commerce Manager</a>: Catálogo → Fontes de dados → Adicionar itens → Feed programado → cole o endereço acima (todo dia).</>,
                <>No Instagram da loja: Configurações → Compras → escolha esse catálogo. Depois dá para marcar os produtos nos posts e nos stories.</>,
                <>Para a Kira postar: no Telegram, peça &quot;divulga o relógio cronógrafo no Instagram&quot;. Ela pega foto, preço, link e legenda da loja. Cada produto também tem a legenda pronta na página dele aqui no painel.</>,
              ]}
            />
            <form action={acaoRastreamento} className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="rotulo">Pixel da Meta (número)</span>
                <input name="metaPixel" defaultValue={r.metaPixel ?? ""} inputMode="numeric" className="campo" />
              </label>
              <label className="block">
                <span className="rotulo">Verificação do domínio (Meta)</span>
                <input name="metaVerificacao" defaultValue={r.metaVerificacao ?? ""} placeholder="cole a meta tag ou o código" className="campo" />
              </label>
              <div className="sm:col-span-2">
                <Enviar className="botao-secundario">Salvar códigos da Meta</Enviar>
              </div>
            </form>
          </div>
        </Cartao>
      </div>
    </>
  );
}
