// Cria as lojas e o primeiro usuário do painel. Pode rodar mais de uma vez.
// Com --demo, também cadastra um catálogo de exemplo (só para testar).
import { eq } from "drizzle-orm";
import { db, fecharDb } from "../src/db";
import { categorias, cupons, lojas, produtos, usuarios, variantes, movimentosEstoque, FRETE_PADRAO, type Loja } from "../src/db/schema";
import { gerarHashSenha } from "../src/lib/auth-hash";
import { criarSlug } from "../src/lib/texto";

const LOJAS = [
  {
    slug: "infinite",
    nome: "Infinite Semijoias",
    slogan: "Semijoias que acompanham você",
    sobre: "Semijoias banhadas a ouro 18k e ródio, com garantia e acabamento feito para durar.",
    corPrimaria: "#2b2320",
    corDestaque: "#b08d57",
  },
  {
    slug: "bg-imports",
    nome: "BG Imports",
    slogan: "Importados selecionados",
    sobre: "Produtos importados com procedência, envio rápido e atendimento de verdade.",
    corPrimaria: "#0f2a44",
    corDestaque: "#d99a1e",
  },
];

type Demo = { categoria: string; nome: string; descricao: string; variantes: [string, number, number, number][]; precoDe?: number; destaque?: boolean };

// [nome da variação, preço, custo, estoque] em centavos
const DEMO: Record<string, Demo[]> = {
  infinite: [
    { categoria: "Brincos", nome: "Brinco Argola Lisa", descricao: "Argola lisa banhada a ouro 18k. Leve e confortável para o dia todo.", destaque: true,
      variantes: [["Pequena", 5990, 1800, 12], ["Média", 6990, 2100, 10], ["Grande", 7990, 2500, 6]] },
    { categoria: "Brincos", nome: "Brinco Ponto de Luz", descricao: "Zircônia cravejada em garras, banho de ouro 18k.", variantes: [["Padrão", 4990, 1300, 20]] },
    { categoria: "Brincos", nome: "Brinco Gota Cristal", descricao: "Gota de cristal facetado com acabamento polido.", destaque: true,
      variantes: [["Dourado", 8990, 2700, 8], ["Ródio", 8990, 2700, 4]] },
    { categoria: "Colares", nome: "Choker Veneziana", descricao: "Corrente veneziana 40 cm com extensor de 5 cm.", variantes: [["Padrão", 11990, 3600, 9]] },
    { categoria: "Colares", nome: "Colar Coração Vazado", descricao: "Pingente de coração vazado em corrente cartier 45 cm.", destaque: true, variantes: [["Padrão", 9990, 3000, 7]] },
    { categoria: "Colares", nome: "Colar Riviera Zircônias", descricao: "Riviera cravejada com zircônias brancas, fecho gaveta.", precoDe: 32990, variantes: [["Padrão", 28990, 9500, 3]] },
    { categoria: "Anéis", nome: "Anel Solitário", descricao: "Solitário clássico com zircônia de 6 mm.", destaque: true,
      variantes: [["Aro 14", 7990, 2400, 3], ["Aro 16", 7990, 2400, 5], ["Aro 18", 7990, 2400, 4], ["Aro 20", 7990, 2400, 2]] },
    { categoria: "Anéis", nome: "Anel Aparador Cravejado", descricao: "Aparador fino cravejado, combina com solitário.",
      variantes: [["Aro 14", 6990, 2000, 4], ["Aro 16", 6990, 2000, 6], ["Aro 18", 6990, 2000, 2]] },
    { categoria: "Pulseiras", nome: "Pulseira Elos Português", descricao: "Elos portugueses 19 cm, banho de ouro 18k.", variantes: [["Padrão", 13990, 4200, 6]] },
    { categoria: "Conjuntos", nome: "Conjunto Gota", descricao: "Colar e brinco gota com cristal. Ótimo para presente.", precoDe: 21990, destaque: true,
      variantes: [["Dourado", 17990, 5400, 5]] },
  ],
  "bg-imports": [
    { categoria: "Eletrônicos", nome: "Fone Bluetooth TWS", descricao: "Fone sem fio com estojo carregador e até 20 h de bateria.", destaque: true,
      variantes: [["Preto", 12990, 5200, 15], ["Branco", 12990, 5200, 10]] },
    { categoria: "Eletrônicos", nome: "Caixa de Som Portátil", descricao: "Caixa bluetooth resistente a respingos, 10 W.", variantes: [["Padrão", 15990, 7000, 8]] },
    { categoria: "Eletrônicos", nome: "Carregador Turbo 20W USB-C", descricao: "Carregador rápido com cabo USB-C de 1 m.", variantes: [["Padrão", 5990, 1900, 30]] },
    { categoria: "Acessórios", nome: "Smartwatch Esportivo", descricao: "Monitor cardíaco, notificações e 7 dias de bateria.", precoDe: 29990, destaque: true,
      variantes: [["Preto", 24990, 11000, 6]] },
    { categoria: "Acessórios", nome: "Mochila Antifurto", descricao: "Zíper oculto, entrada USB e compartimento para notebook 15,6\".", variantes: [["Cinza", 18990, 8000, 7]] },
    { categoria: "Casa", nome: "Garrafa Térmica 1 L", descricao: "Aço inox, mantém gelado por 24 h e quente por 12 h.", destaque: true, variantes: [["Preta", 8990, 3200, 12], ["Branca", 8990, 3200, 9]] },
  ],
};

async function garantirLoja(dados: (typeof LOJAS)[number]): Promise<Loja> {
  const [existente] = await db.select().from(lojas).where(eq(lojas.slug, dados.slug));
  if (existente) return existente;
  const [nova] = await db.insert(lojas).values({ ...dados, frete: FRETE_PADRAO }).returning();
  console.log(`Loja criada: ${nova.nome} (/loja/${nova.slug})`);
  return nova;
}

async function catalogoDemo(loja: Loja) {
  const ja = await db.select({ id: produtos.id }).from(produtos).where(eq(produtos.lojaId, loja.id)).limit(1);
  if (ja.length) return console.log(`${loja.nome}: já tem produtos, catálogo de exemplo ignorado.`);
  const itens = DEMO[loja.slug] ?? [];
  const cats = new Map<string, number>();
  for (const nome of [...new Set(itens.map((i) => i.categoria))]) {
    const [c] = await db.insert(categorias).values({ lojaId: loja.id, nome, slug: criarSlug(nome), ordem: cats.size }).returning();
    cats.set(nome, c.id);
  }
  for (const item of itens) {
    const [p] = await db
      .insert(produtos)
      .values({ lojaId: loja.id, categoriaId: cats.get(item.categoria), nome: item.nome, slug: criarSlug(item.nome), descricao: item.descricao, destaque: !!item.destaque })
      .returning();
    for (const [ordem, [nome, preco, custo, estoque]] of item.variantes.entries()) {
      const [v] = await db
        .insert(variantes)
        .values({ produtoId: p.id, nome, precoCentavos: preco, precoDeCentavos: item.precoDe ?? null, custoCentavos: custo, estoque, ordem, sku: `${criarSlug(item.nome).slice(0, 12)}-${ordem + 1}`.toUpperCase() })
        .returning();
      await db.insert(movimentosEstoque).values({ lojaId: loja.id, varianteId: v.id, quantidade: estoque, tipo: "entrada", nota: "Estoque inicial (exemplo)" });
    }
  }
  await db
    .update(lojas)
    .set({
      whatsapp: "11999999999",
      pixChave: "pix@exemplo.com.br",
      pixNome: loja.nome,
      pixCidade: "Sao Paulo",
      frete: { ...FRETE_PADRAO, entrega: { ...FRETE_PADRAO.entrega, valorPadraoCentavos: 2490, porUF: { SP: 1490 }, gratisAcimaCentavos: 29900 } },
    })
    .where(eq(lojas.id, loja.id));
  await db.insert(cupons).values({ lojaId: loja.id, codigo: "BEMVINDO10", tipo: "percentual", valor: 10 }).onConflictDoNothing();
  console.log(`${loja.nome}: catálogo de exemplo cadastrado (${itens.length} produtos).`);
}

async function main() {
  const demo = process.argv.includes("--demo");
  for (const dados of LOJAS) {
    const loja = await garantirLoja(dados);
    if (demo) await catalogoDemo(loja);
  }
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const senha = process.env.ADMIN_SENHA;
  if (email && senha) {
    if (senha.length < 10) throw new Error("ADMIN_SENHA precisa ter pelo menos 10 caracteres.");
    const [existe] = await db.select().from(usuarios).where(eq(usuarios.email, email));
    if (!existe) {
      await db.insert(usuarios).values({ nome: email.split("@")[0], email, senhaHash: await gerarHashSenha(senha) });
      console.log(`Usuário do painel criado: ${email}`);
    }
  } else {
    console.log("Defina ADMIN_EMAIL e ADMIN_SENHA para criar o usuário do painel.");
  }
}

main()
  .then(fecharDb)
  .catch(async (e) => {
    console.error(e);
    await fecharDb();
    process.exit(1);
  });
