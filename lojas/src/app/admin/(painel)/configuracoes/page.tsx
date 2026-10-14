/* eslint-disable @next/next/no-img-element */
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { usuarios } from "@/db/schema";
import { contexto } from "@/lib/painel";
import { reaisParaCampo } from "@/lib/dinheiro";
import { tokenMercadoPago } from "@/lib/mercadopago";
import { urlDaLoja } from "@/lib/dominios";
import { Aviso, Cabecalho, Cartao } from "@/components/admin/ui";
import { Enviar } from "@/components/admin/Botoes";
import { acaoLogo, acaoNovaLoja, acaoNovoUsuario, acaoSalvarLoja, acaoTrocarSenha } from "./acoes";

export default async function Configuracoes({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { loja } = await contexto();
  const [sp, equipe] = await Promise.all([searchParams, db.select({ email: usuarios.email, nome: usuarios.nome }).from(usuarios).orderBy(asc(usuarios.id))]);
  const f = loja.frete;
  const porUF = Object.entries(f.entrega.porUF).map(([uf, v]) => `${uf}=${reaisParaCampo(v)}`).join("\n");
  const mpVar = `MERCADOPAGO_TOKEN_${loja.slug.toUpperCase().replace(/-/g, "_")}`;

  return (
    <>
      <Cabecalho titulo="Configurações" />
      <Aviso ok={sp.ok} erro={sp.erro} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <form action={acaoSalvarLoja} className="space-y-6">
          <Cartao titulo="Loja">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="rotulo">Nome</span><input name="nome" defaultValue={loja.nome} className="campo" required /></label>
              <label className="block"><span className="rotulo">Frase de destaque</span><input name="slogan" defaultValue={loja.slogan ?? ""} className="campo" /></label>
              <label className="block sm:col-span-2"><span className="rotulo">Sobre a loja (aparece na vitrine e no rodapé)</span><textarea name="sobre" rows={2} defaultValue={loja.sobre ?? ""} className="campo" /></label>
              <label className="block sm:col-span-2"><span className="rotulo">Estilo da vitrine</span>
                <select name="tema" defaultValue={loja.tema} className="campo">
                  <option value="elegante">Elegante: títulos com serifa e cabeçalho claro</option>
                  <option value="moderno">Moderno: títulos em caixa alta e cabeçalho escuro</option>
                  <option value="relojoaria">Relojoaria: escuro com dourado, abertura com o produto em destaque</option>
                </select>
              </label>
              <label className="block"><span className="rotulo">Cor principal</span><input type="color" name="corPrimaria" defaultValue={loja.corPrimaria} className="h-10 w-full cursor-pointer rounded-md border border-stone-300" /></label>
              <label className="block"><span className="rotulo">Cor de destaque</span><input type="color" name="corDestaque" defaultValue={loja.corDestaque} className="h-10 w-full cursor-pointer rounded-md border border-stone-300" /></label>
              <label className="block"><span className="rotulo">WhatsApp (com DDD)</span><input name="whatsapp" defaultValue={loja.whatsapp ?? ""} className="campo" inputMode="tel" /></label>
              <label className="block"><span className="rotulo">Instagram</span><input name="instagram" defaultValue={loja.instagram ?? ""} placeholder="@sualoja" className="campo" /></label>
              <label className="block sm:col-span-2"><span className="rotulo">E-mail de contato</span><input name="email" type="email" defaultValue={loja.email ?? ""} className="campo" /></label>
            </div>
            <p className="mt-3 text-xs text-stone-500">Endereço da vitrine: <a href={urlDaLoja(loja.slug)} target="_blank" rel="noopener" className="underline">{urlDaLoja(loja.slug)}</a></p>
          </Cartao>

          <Cartao titulo="Pagamento">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block sm:col-span-3"><span className="rotulo">Chave Pix</span><input name="pixChave" defaultValue={loja.pixChave ?? ""} placeholder="CNPJ, e-mail, telefone ou chave aleatória" className="campo" /></label>
              <label className="block sm:col-span-2"><span className="rotulo">Nome do recebedor</span><input name="pixNome" defaultValue={loja.pixNome ?? ""} className="campo" /></label>
              <label className="block"><span className="rotulo">Cidade</span><input name="pixCidade" defaultValue={loja.pixCidade ?? ""} className="campo" /></label>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block"><span className="rotulo">Desconto no Pix (%)</span><input name="descontoPixPct" type="number" min={0} max={30} defaultValue={loja.descontoPixPct} className="campo" /></label>
              <label className="block"><span className="rotulo">Parcelas sem juros (mostradas na vitrine)</span><input name="parcelasSemJuros" type="number" min={1} max={12} defaultValue={loja.parcelasSemJuros} className="campo" /></label>
            </div>
            <p className="mt-2 text-xs text-stone-500">As parcelas sem juros precisam estar ligadas também na sua conta do Mercado Pago (você assume os juros).</p>
            <p className="mt-3 text-xs text-stone-500">
              Mercado Pago: {tokenMercadoPago(loja.slug) ? <span className="text-green-700">ligado</span> : <>desligado. Para ligar, coloque o Access Token na variável <code>{mpVar}</code> do servidor.</>}
            </p>
          </Cartao>

          <Cartao titulo="Entrega">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="retiradaAtivo" defaultChecked={f.retirada.ativo} /> Oferecer retirada</label>
                <input name="retiradaEndereco" defaultValue={f.retirada.endereco} placeholder="Onde retirar (ou: combinar pelo WhatsApp)" className="campo" />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="entregaAtivo" defaultChecked={f.entrega.ativo} /> Oferecer envio</label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label><span className="rotulo">Frete padrão (R$)</span><input name="fretePadrao" defaultValue={reaisParaCampo(f.entrega.valorPadraoCentavos)} className="campo" inputMode="decimal" /></label>
                  <label><span className="rotulo">Grátis a partir de (R$)</span><input name="gratisAcima" defaultValue={reaisParaCampo(f.entrega.gratisAcimaCentavos)} placeholder="sem frete grátis" className="campo" inputMode="decimal" /></label>
                  <label><span className="rotulo">Prazo</span><input name="prazo" defaultValue={f.entrega.prazo} className="campo" /></label>
                </div>
                <label className="block"><span className="rotulo">Frete por estado (um por linha, ex.: SP=14,90)</span><textarea name="porUF" rows={3} defaultValue={porUF} className="campo font-mono text-xs" /></label>
              </div>
            </div>
          </Cartao>

          <Cartao titulo="Estoque e pedidos">
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className="rotulo">Avisar estoque baixo a partir de (un.)</span><input name="estoqueMinimo" type="number" min={0} defaultValue={loja.estoqueMinimo} className="campo" /></label>
              <label><span className="rotulo">Cancelar pedido do site não pago após (horas)</span><input name="horasReserva" type="number" min={1} defaultValue={loja.horasReserva} className="campo" /></label>
            </div>
          </Cartao>
          <div className="flex justify-end"><Enviar>Salvar configurações</Enviar></div>
        </form>

        <div className="space-y-6">
          <Cartao titulo="Logo">
            {loja.logoUrl && <img src={loja.logoUrl} alt="Logo" className="mb-3 max-h-20 w-auto" />}
            <form action={acaoLogo} className="space-y-2">
              <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" className="text-sm" />
              <div className="flex gap-2">
                <Enviar className="botao-secundario">Enviar logo</Enviar>
                {loja.logoUrl && <button name="remover" value="on" className="botao-perigo">Remover</button>}
              </div>
            </form>
          </Cartao>
          <Cartao titulo="Minha senha">
            <form action={acaoTrocarSenha} className="space-y-2">
              <input name="atual" type="password" placeholder="Senha atual" className="campo" autoComplete="current-password" required />
              <input name="nova" type="password" placeholder="Nova senha (mín. 10)" className="campo" autoComplete="new-password" required />
              <input name="confirmar" type="password" placeholder="Repita a nova senha" className="campo" autoComplete="new-password" required />
              <Enviar className="botao-secundario w-full">Trocar senha</Enviar>
            </form>
          </Cartao>
          <Cartao titulo="Equipe">
            <ul className="mb-3 space-y-1 text-sm">
              {equipe.map((u) => <li key={u.email}>{u.nome} <span className="text-stone-500">· {u.email}</span></li>)}
            </ul>
            <details>
              <summary className="cursor-pointer text-sm underline">Adicionar pessoa</summary>
              <form action={acaoNovoUsuario} className="mt-2 space-y-2">
                <input name="nome" placeholder="Nome" className="campo" />
                <input name="email" type="email" placeholder="E-mail" className="campo" required />
                <input name="senha" type="password" placeholder="Senha inicial (mín. 10)" className="campo" autoComplete="new-password" required />
                <Enviar className="botao-secundario w-full">Adicionar</Enviar>
              </form>
            </details>
            <p className="mt-2 text-xs text-stone-500">Toda pessoa da equipe acessa todas as lojas.</p>
          </Cartao>
          <Cartao titulo="Nova loja">
            <form action={acaoNovaLoja} className="space-y-2">
              <input name="nome" placeholder="Nome da loja" className="campo" required />
              <input name="slug" placeholder="Endereço (ex.: minha-loja)" className="campo" />
              <Enviar className="botao-secundario w-full">Criar loja</Enviar>
            </form>
          </Cartao>
        </div>
      </div>
    </>
  );
}
