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
    tema: "elegante" as const,
    instagram: undefined as string | undefined,
    categorias: ["Brincos", "Colares", "Anéis", "Pulseiras", "Conjuntos"],
  },
  {
    slug: "bg-imports",
    nome: "BG Imports",
    slogan: "Relógios e acessórios masculinos",
    sobre: "Relógios e acessórios masculinos importados, com garantia, nota e envio rápido para todo o Brasil.",
    corPrimaria: "#141414",
    corDestaque: "#a3844c",
    tema: "relojoaria" as const,
    instagram: "bgimports_brasil",
    categorias: ["Relógios", "Pulseiras", "Carteiras", "Cintos", "Óculos", "Correntes", "Kits presente"],
  },
];

type Demo = {
  categoria: string;
  nome: string;
  descricao: string;
  variantes: [string, number, number, number][];
  precoDe?: number;
  destaque?: boolean;
  marca?: string;
  especificacoes?: [string, string][];
  garantia?: string;
  itensInclusos?: string;
};

const GARANTIA_RELOGIO = "12 meses contra defeito de fabricação";
const ESTOJO = "Estojo, manual e certificado de garantia";

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
    { categoria: "Relógios", nome: "Relógio Cronógrafo Aço Preto", marca: "BG Collection", destaque: true, precoDe: 45990,
      descricao: "Cronógrafo de caixa robusta em aço com acabamento preto fosco. Funciona com três subdiscos e data.",
      variantes: [["Padrão", 38990, 16000, 6]],
      especificacoes: [["Caixa", "44 mm, aço inoxidável"], ["Pulseira", "Aço inoxidável com fecho dobrável"], ["Mecanismo", "Quartzo, cronógrafo"], ["Resistência à água", "5 ATM (respingos e lavar as mãos)"], ["Vidro", "Mineral"]],
      garantia: GARANTIA_RELOGIO, itensInclusos: ESTOJO },
    { categoria: "Relógios", nome: "Relógio Minimalista Couro", marca: "BG Collection", destaque: true,
      descricao: "Mostrador limpo e caixa fina para o dia a dia e para o trabalho.",
      variantes: [["Pulseira marrom", 24990, 9500, 8], ["Pulseira preta", 24990, 9500, 5]],
      especificacoes: [["Caixa", "40 mm, aço inoxidável"], ["Pulseira", "Couro legítimo, 20 mm"], ["Mecanismo", "Quartzo"], ["Resistência à água", "3 ATM"]],
      garantia: GARANTIA_RELOGIO, itensInclusos: ESTOJO },
    { categoria: "Relógios", nome: "Relógio Automático Skeleton", marca: "BG Collection", destaque: true,
      descricao: "Mostrador vazado que deixa ver a máquina funcionando. Não usa bateria: dá corda com o movimento do pulso.",
      variantes: [["Padrão", 69990, 30000, 3]],
      especificacoes: [["Caixa", "42 mm, aço inoxidável"], ["Pulseira", "Couro legítimo"], ["Mecanismo", "Automático, reserva de 36 h"], ["Resistência à água", "5 ATM"], ["Fundo", "Transparente"]],
      garantia: GARANTIA_RELOGIO, itensInclusos: ESTOJO },
    { categoria: "Relógios", nome: "Relógio Mergulhador Azul", marca: "Linha Sport",
      descricao: "Inspirado nos relógios de mergulho, com bisel giratório e ponteiros luminosos.",
      variantes: [["Padrão", 45990, 19000, 4]],
      especificacoes: [["Caixa", "43 mm, aço inoxidável"], ["Bisel", "Giratório unidirecional"], ["Mecanismo", "Quartzo"], ["Resistência à água", "20 ATM (natação e mergulho raso)"], ["Ponteiros", "Luminosos"]],
      garantia: GARANTIA_RELOGIO, itensInclusos: ESTOJO },
    { categoria: "Relógios", nome: "Relógio Digital Esportivo", marca: "Linha Sport",
      descricao: "Leve e resistente, com cronômetro, alarme e luz de fundo.",
      variantes: [["Preto", 15990, 5500, 15], ["Verde militar", 15990, 5500, 7]],
      especificacoes: [["Caixa", "46 mm, resina"], ["Funções", "Cronômetro, alarme, timer, luz"], ["Resistência à água", "10 ATM"], ["Bateria", "Até 3 anos"]],
      garantia: GARANTIA_RELOGIO, itensInclusos: "Caixa e manual" },
    { categoria: "Carteiras", nome: "Carteira Slim Couro", marca: "BG Collection", destaque: true,
      descricao: "Fina, com 6 divisórias para cartões e espaço para notas. Proteção RFID.",
      variantes: [["Preta", 8990, 2800, 12], ["Café", 8990, 2800, 9]],
      especificacoes: [["Material", "Couro legítimo"], ["Medidas", "11 × 8,5 cm"], ["Divisórias", "6 para cartões + 1 para notas"]],
      garantia: "3 meses" },
    { categoria: "Cintos", nome: "Cinto Couro Reversível", marca: "BG Collection",
      descricao: "Um lado preto e outro marrom, fivela giratória em metal escovado.",
      variantes: [["100 cm", 11990, 4000, 5], ["110 cm", 11990, 4000, 6], ["120 cm", 11990, 4000, 3]],
      especificacoes: [["Material", "Couro legítimo"], ["Largura", "3,5 cm"], ["Fivela", "Giratória, metal escovado"]],
      garantia: "3 meses" },
    { categoria: "Pulseiras", nome: "Pulseira Aço e Couro Trançado", marca: "Linha Sport",
      descricao: "Couro trançado com fecho magnético em aço inoxidável.",
      variantes: [["Preta", 6990, 2000, 14], ["Marrom", 6990, 2000, 10]],
      especificacoes: [["Material", "Couro trançado e aço inoxidável"], ["Comprimento", "21 cm"], ["Fecho", "Magnético"]] },
    { categoria: "Óculos", nome: "Óculos de Sol Aviador", marca: "Linha Sport",
      descricao: "Clássico aviador com proteção UV400.",
      variantes: [["Dourado / lente verde", 14990, 4500, 8], ["Preto / lente cinza", 14990, 4500, 6]],
      especificacoes: [["Proteção", "UV400"], ["Armação", "Metal"], ["Lente", "Policarbonato"]],
      garantia: "3 meses", itensInclusos: "Estojo e flanela" },
    { categoria: "Correntes", nome: "Corrente Grumet Aço 60 cm", marca: "BG Collection",
      descricao: "Corrente grumet em aço inoxidável que não escurece.",
      variantes: [["Prata", 9990, 3000, 10], ["Dourada", 10990, 3400, 6]],
      especificacoes: [["Material", "Aço inoxidável 316L"], ["Comprimento", "60 cm"], ["Espessura", "5 mm"]],
      garantia: "6 meses" },
    { categoria: "Kits presente", nome: "Kit Presente Relógio + Carteira", marca: "BG Collection", destaque: true, precoDe: 33980,
      descricao: "Relógio minimalista com pulseira de couro e carteira slim, na caixa de presente.",
      variantes: [["Marrom", 29990, 12300, 4]],
      garantia: GARANTIA_RELOGIO, itensInclusos: "Relógio, carteira e caixa de presente" },
  ],
};

async function garantirLoja({ categorias: cats, ...dados }: (typeof LOJAS)[number]): Promise<Loja> {
  const [existente] = await db.select().from(lojas).where(eq(lojas.slug, dados.slug));
  if (existente) return existente;
  const [nova] = await db.insert(lojas).values({ ...dados, frete: FRETE_PADRAO }).returning();
  await db.insert(categorias).values(cats.map((nome, ordem) => ({ lojaId: nova.id, nome, slug: criarSlug(nome), ordem })));
  console.log(`Loja criada: ${nova.nome} (/loja/${nova.slug})`);
  return nova;
}

async function catalogoDemo(loja: Loja) {
  const ja = await db.select({ id: produtos.id }).from(produtos).where(eq(produtos.lojaId, loja.id)).limit(1);
  if (ja.length) return console.log(`${loja.nome}: já tem produtos, catálogo de exemplo ignorado.`);
  const itens = DEMO[loja.slug] ?? [];
  const cats = new Map((await db.select().from(categorias).where(eq(categorias.lojaId, loja.id))).map((c) => [c.nome, c.id]));
  for (const nome of new Set(itens.map((i) => i.categoria))) {
    if (cats.has(nome)) continue;
    const [c] = await db.insert(categorias).values({ lojaId: loja.id, nome, slug: criarSlug(nome), ordem: cats.size }).returning();
    cats.set(nome, c.id);
  }
  for (const item of itens) {
    const [p] = await db
      .insert(produtos)
      .values({
        lojaId: loja.id,
        categoriaId: cats.get(item.categoria),
        nome: item.nome,
        slug: criarSlug(item.nome),
        descricao: item.descricao,
        destaque: !!item.destaque,
        marca: item.marca ?? null,
        especificacoes: (item.especificacoes ?? []).map(([nome, valor]) => ({ nome, valor })),
        garantia: item.garantia ?? null,
        itensInclusos: item.itensInclusos ?? null,
      })
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
      // a BG mostra preço no Pix e parcelamento, que pesam em produto de valor mais alto
      ...(loja.slug === "bg-imports" ? { descontoPixPct: 5, parcelasSemJuros: 6 } : {}),
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
