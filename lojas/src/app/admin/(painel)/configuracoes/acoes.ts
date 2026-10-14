"use server";

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { lojas, usuarios, FRETE_PADRAO, type ConfigFrete } from "@/db/schema";
import { centavos, contexto, executar, inteiro, marcado, texto, textoOuNulo } from "@/lib/painel";
import { conferirSenha, gerarHashSenha } from "@/lib/auth-hash";
import { ErroNegocio } from "@/lib/erros";
import { lerReais } from "@/lib/dinheiro";
import { UFS } from "@/lib/frete";
import { corValida, criarSlug, soDigitos } from "@/lib/texto";
import { apagarImagem, salvarImagem } from "@/lib/uploads";

const VOLTAR = "/admin/configuracoes";

export async function acaoSalvarLoja(fd: FormData) {
  const { loja } = await contexto();
  await executar(VOLTAR, async () => {
    const nome = texto(fd, "nome");
    if (!nome) throw new ErroNegocio("Informe o nome da loja.");
    const porUF: Record<string, number> = {};
    for (const linha of texto(fd, "porUF").split(/\n|;/)) {
      if (!linha.trim()) continue;
      const [uf, valor] = linha.split(/[=:]/).map((s) => s?.trim());
      const v = lerReais(valor);
      if (!uf || !UFS.includes(uf.toUpperCase()) || v == null) throw new ErroNegocio(`Frete por estado: não entendi "${linha.trim()}". Use SP=15,90.`);
      porUF[uf.toUpperCase()] = v;
    }
    const frete: ConfigFrete = {
      retirada: { ativo: marcado(fd, "retiradaAtivo"), endereco: texto(fd, "retiradaEndereco") },
      entrega: {
        ativo: marcado(fd, "entregaAtivo"),
        valorPadraoCentavos: centavos(fd, "fretePadrao") ?? FRETE_PADRAO.entrega.valorPadraoCentavos,
        porUF,
        gratisAcimaCentavos: centavos(fd, "gratisAcima"),
        prazo: texto(fd, "prazo") || FRETE_PADRAO.entrega.prazo,
      },
    };
    await db
      .update(lojas)
      .set({
        nome,
        slogan: textoOuNulo(fd, "slogan"),
        sobre: textoOuNulo(fd, "sobre"),
        corPrimaria: corValida(texto(fd, "corPrimaria"), loja.corPrimaria),
        corDestaque: corValida(texto(fd, "corDestaque"), loja.corDestaque),
        whatsapp: soDigitos(texto(fd, "whatsapp")) || null,
        instagram: textoOuNulo(fd, "instagram")?.replace(/^@/, "") ?? null,
        email: textoOuNulo(fd, "email"),
        pixChave: textoOuNulo(fd, "pixChave"),
        pixNome: textoOuNulo(fd, "pixNome"),
        pixCidade: textoOuNulo(fd, "pixCidade"),
        tema: texto(fd, "tema") === "moderno" ? "moderno" : "elegante",
        descontoPixPct: Math.min(30, Math.max(0, inteiro(fd, "descontoPixPct", 0))),
        parcelasSemJuros: Math.min(12, Math.max(1, inteiro(fd, "parcelasSemJuros", 1))),
        estoqueMinimo: Math.max(0, inteiro(fd, "estoqueMinimo", 3)),
        horasReserva: Math.min(24 * 30, Math.max(1, inteiro(fd, "horasReserva", 48))),
        frete,
      })
      .where(eq(lojas.id, loja.id));
  }, "Configurações salvas.");
}

export async function acaoLogo(fd: FormData) {
  const { loja } = await contexto();
  await executar(VOLTAR, async () => {
    if (marcado(fd, "remover")) {
      if (loja.logoUrl) await apagarImagem(loja.logoUrl);
      await db.update(lojas).set({ logoUrl: null }).where(eq(lojas.id, loja.id));
      return;
    }
    const arquivo = fd.get("logo");
    if (!(arquivo instanceof File) || arquivo.size === 0) throw new ErroNegocio("Escolha a imagem do logo.");
    const url = await salvarImagem(arquivo);
    if (loja.logoUrl) await apagarImagem(loja.logoUrl);
    await db.update(lojas).set({ logoUrl: url }).where(eq(lojas.id, loja.id));
  }, "Logo atualizado.");
}

export async function acaoNovaLoja(fd: FormData) {
  await contexto();
  await executar(VOLTAR, async () => {
    const nome = texto(fd, "nome");
    if (!nome) throw new ErroNegocio("Informe o nome da nova loja.");
    const slug = criarSlug(texto(fd, "slug") || nome);
    await db.insert(lojas).values({ nome, slug, frete: FRETE_PADRAO });
    (await cookies()).set("loja_painel", slug, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 365 * 86400 });
  }, "Loja criada. Você já está nela.");
}

export async function acaoTrocarSenha(fd: FormData) {
  const { usuario } = await contexto();
  await executar(VOLTAR, async () => {
    const nova = String(fd.get("nova") ?? "");
    if (nova.length < 10) throw new ErroNegocio("A nova senha precisa ter pelo menos 10 caracteres.");
    if (nova !== String(fd.get("confirmar") ?? "")) throw new ErroNegocio("A confirmação não bate com a nova senha.");
    const [u] = await db.select().from(usuarios).where(eq(usuarios.id, usuario.id));
    if (!(await conferirSenha(String(fd.get("atual") ?? ""), u.senhaHash))) throw new ErroNegocio("Senha atual incorreta.");
    await db.update(usuarios).set({ senhaHash: await gerarHashSenha(nova) }).where(eq(usuarios.id, usuario.id));
  }, "Senha alterada.");
}

export async function acaoNovoUsuario(fd: FormData) {
  await contexto();
  await executar(VOLTAR, async () => {
    const email = texto(fd, "email").toLowerCase();
    const senha = String(fd.get("senha") ?? "");
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new ErroNegocio("E-mail inválido.");
    if (senha.length < 10) throw new ErroNegocio("A senha precisa ter pelo menos 10 caracteres.");
    await db.insert(usuarios).values({ nome: texto(fd, "nome") || email.split("@")[0], email, senhaHash: await gerarHashSenha(senha) });
  }, "Usuário criado.");
}
