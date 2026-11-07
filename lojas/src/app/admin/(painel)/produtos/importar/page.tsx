import { redirect } from "next/navigation";
import { contexto, comAviso, texto } from "@/lib/painel";
import { COLUNAS_IMPORTACAO, importarProdutos } from "@/lib/importacao";
import { ErroNegocio } from "@/lib/erros";
import { Aviso, Cabecalho, Cartao } from "@/components/admin/ui";
import { Enviar } from "@/components/admin/Botoes";

async function acaoImportar(fd: FormData) {
  "use server";
  const { loja } = await contexto();
  const arquivo = fd.get("arquivo");
  let conteudo = texto(fd, "texto");
  if (arquivo instanceof File && arquivo.size > 0) {
    if (arquivo.size > 5 * 1024 * 1024) redirect(comAviso("/admin/produtos/importar", "erro", "Arquivo maior que 5 MB."));
    conteudo = await arquivo.text();
  }
  let destino: string;
  try {
    const r = await importarProdutos(loja.id, conteudo);
    const resumo = `${r.criados} criado(s), ${r.atualizados} atualizado(s).`;
    destino = r.erros.length
      ? comAviso("/admin/produtos/importar", "erro", `${resumo} Problemas: ${r.erros.slice(0, 10).join(" ")}${r.erros.length > 10 ? " …" : ""}`)
      : comAviso("/admin/produtos", "ok", `Importação concluída: ${resumo}`);
  } catch (e) {
    if (!(e instanceof ErroNegocio)) throw e;
    destino = comAviso("/admin/produtos/importar", "erro", e.message);
  }
  redirect(destino);
}

export default async function Importar({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  await contexto();
  const sp = await searchParams;
  const exemplo = [
    COLUNAS_IMPORTACAO.join(";"),
    "BG Pista Cronógrafo;BG Imports;Relógios;Pulseira aço;BG-PISTA-01;7891234567895;389,90;459,90;160,00;4;Cronógrafo esportivo;Caixa: 42 mm | Vidro: mineral;90 dias;Caixa e manual;sim",
    "BG Pista Cronógrafo;BG Imports;Relógios;Pulseira couro;BG-PISTA-02;;389,90;;160,00;2;;;;;sim",
  ].join("\n");
  return (
    <>
      <Cabecalho titulo="Importar produtos" />
      <Aviso ok={sp.ok} erro={sp.erro} />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Cartao>
          <form action={acaoImportar} className="space-y-4">
            <label className="block">
              <span className="rotulo">Arquivo CSV (Excel: Salvar como → CSV)</span>
              <input type="file" name="arquivo" accept=".csv,text/csv,text/plain" className="text-sm" />
            </label>
            <label className="block">
              <span className="rotulo">ou cole aqui</span>
              <textarea name="texto" rows={10} className="campo font-mono text-xs" placeholder={exemplo} />
            </label>
            <Enviar pendente="Importando…">Importar</Enviar>
          </form>
        </Cartao>
        <Cartao titulo="Como montar a planilha">
          <ul className="list-disc space-y-1 pl-4 text-sm text-stone-600">
            <li>Primeira linha com os nomes das colunas: <code className="text-xs">{COLUNAS_IMPORTACAO.join(", ")}</code>.</li>
            <li>Só <b>nome</b> e <b>preco</b> são obrigatórias. Peça ainda sem preço pode entrar com <b>ativo</b> = nao: fica como rascunho até você pôr o preço.</li>
            <li><b>ficha</b> vira a ficha técnica: <code className="text-xs">Caixa: 42 mm | Vidro: mineral</code>. <b>garantia</b> e <b>vem_com</b> aparecem na página do produto.</li>
            <li>Linhas com o mesmo nome viram variações do mesmo produto.</li>
            <li>Se o <b>SKU</b> já existir, a linha atualiza preço, custo e estoque daquela variação.</li>
            <li>Serve para trazer o catálogo exportado do MarketUP ou de outra planilha.</li>
            <li>Use só nomes da sua marca. Produto que cita outra marca fica fora do Google, do Instagram e do Mercado Livre.</li>
          </ul>
        </Cartao>
      </div>
    </>
  );
}
