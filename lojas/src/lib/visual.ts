/**
 * Conteúdo visual fixo de cada loja: banners, frases da abertura, logos e dados da empresa.
 * Fica no código (e não no banco) porque muda pouco e vem junto com as imagens em public/lojas/<slug>/.
 * Loja sem entrada aqui usa só o que está no banco (nome, slogan, sobre, logo).
 */
export type Painel = { titulo: string; frase: string; imagem: string; categoria: string };

export type VisualLoja = {
  logoCabecalho?: string;
  logoRodape?: string;
  abertura?: { titulo: string[]; frase: string; imagem: string; botao: string };
  paineis?: Painel[];
  /** painel largo do meio da página (ex.: linha masculina) */
  destaque?: Painel;
  empresa?: { razao: string; cnpj: string; endereco: string };
  /** ícones do site e do app (instalar na tela inicial) */
  app?: { nomeCurto: string; descricao: string; cor: string; favicon: string; apple: string; icone192: string; icone512: string; mascaravel: string };
  /** o que aparece no menu de cima, além das coleções */
  menu?: { nome: string; href: string }[];
};

const INFINITE: VisualLoja = {
  logoCabecalho: "/lojas/infinite/logo-cabecalho.png",
  logoRodape: "/lojas/infinite/logo-text.png",
  abertura: {
    titulo: ["Um detalhe.", "Outra presença."],
    frase: "Semijoias que acompanham os seus próximos capítulos.",
    imagem: "/lojas/infinite/hero.webp",
    botao: "Explorar coleção",
  },
  paineis: [
    { titulo: "Brincos", frase: "Leveza em cada movimento.", imagem: "/lojas/infinite/brincos-panel.webp", categoria: "brincos" },
    { titulo: "Colares", frase: "Histórias que se conectam.", imagem: "/lojas/infinite/colares-panel.webp", categoria: "colares" },
  ],
  destaque: { titulo: "Linha Masculina", frase: "Presença em cada detalhe.", imagem: "/lojas/infinite/masculina.webp", categoria: "linha-masculina" },
  empresa: {
    razao: "JANAINA DE SOUZA OLIVEIRA",
    cnpj: "53.930.694/0001-22",
    endereco: "Rua Vereador Genésio Alves do Couto, 160 - Cidade Nova, Juatuba/MG - CEP 35675-000",
  },
  app: {
    nomeCurto: "Infinite",
    descricao: "Semijoias Infinite: peças, coleções e seus pedidos na tela inicial.",
    cor: "#0b0b0c",
    favicon: "/lojas/infinite/favicon-32.png",
    apple: "/lojas/infinite/apple-touch-icon.png",
    icone192: "/lojas/infinite/icon-192.png",
    icone512: "/lojas/infinite/icon-512.png",
    mascaravel: "/lojas/infinite/icon-maskable-512.png",
  },
  menu: [
    { nome: "Novidades", href: "/catalogo?ordem=novidades" },
    { nome: "Linha Masculina", href: "/categoria/linha-masculina" },
    { nome: "Quem somos", href: "/quem-somos" },
  ],
};

// BG Imports: o visual é o do tema relojoaria; aqui só o app (monograma provisório até chegar o logo)
// e, quando o dono mandar, os dados da empresa (empresa: { razao, cnpj, endereco }).
const BG: VisualLoja = {
  app: {
    nomeCurto: "BG Imports",
    descricao: "BG Imports: relógios e acessórios, coleções e seus pedidos na tela inicial.",
    cor: "#141414",
    favicon: "/lojas/bg-imports/favicon-32.png",
    apple: "/lojas/bg-imports/apple-touch-icon.png",
    icone192: "/lojas/bg-imports/icon-192.png",
    icone512: "/lojas/bg-imports/icon-512.png",
    mascaravel: "/lojas/bg-imports/icon-maskable-512.png",
  },
};

const VISUAIS: Record<string, VisualLoja> = { infinite: INFINITE, "bg-imports": BG };

export function visualDaLoja(slug: string): VisualLoja {
  return VISUAIS[slug] ?? {};
}
