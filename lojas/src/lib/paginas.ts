/**
 * Páginas institucionais de cada loja (quem somos, entregas, trocas, termos, privacidade...).
 * Os textos ficam no código, como a identidade visual (src/lib/visual.ts). Placeholders trocados na hora:
 * {loja} nome, {razao}, {cnpj}, {endereco}, {email}, {whatsapp}, {instagram}, {gratis} (frete grátis),
 * {prazoEntrega}, {horasReserva} e {parcelas}.
 */
import type { Loja } from "@/db/schema";
import { formatarReais } from "./dinheiro";
import { visualDaLoja } from "./visual";

export type Bloco = { titulo?: string; texto?: string[]; lista?: string[] };
export type Pagina = { slug: string; titulo: string; subtitulo?: string; versao?: string; blocos: Bloco[]; grupo: "institucional" | "ajuda" };

// cada dado numa linha: a que ficar sem dado (ex.: loja ainda sem CNPJ) some sozinha
const CONTATO: Bloco = {
  titulo: "Quem vende",
  texto: ["{razao}", "CNPJ {cnpj}", "{endereco}", "E-mail: {email}", "WhatsApp: {whatsapp}"],
};

const INFINITE: Pagina[] = [
  {
    slug: "quem-somos",
    grupo: "institucional",
    titulo: "Quem somos",
    subtitulo: "Sofisticação que encanta",
    blocos: [
      {
        texto: [
          "Na Infinite, não vendemos apenas semijoias: entregamos sofisticação, exclusividade e estilo para mulheres que desejam se destacar. Nossas peças nascem de inspirações do mundo todo e traduzem tendências e referências culturais em desenhos atemporais, que valorizam a beleza e a personalidade de cada uma.",
          "Acompanhamos os principais eventos de moda do Brasil e da América Latina para trazer as peças mais desejadas da estação. E investimos em qualidade em cada etapa: cada pedra é cravejada artesanalmente e cada detalhe é pensado para durar e brilhar.",
          "Nossas coleções são limitadas, porque acreditamos que cada mulher merece exclusividade.",
        ],
      },
      {
        titulo: "O que nos move",
        lista: [
          "Banho de ouro 18k: camadas generosas de banho para um brilho que dura, com acabamento antialérgico.",
          "Coleções limitadas: peças escolhidas a cada estação, em poucas unidades, para você usar algo exclusivo.",
          "Garantia em cada peça: contra defeitos de fabricação e do banho.",
          "Consertos: troca de fecho, rebanho e reposição de pedras, em até 30 dias úteis.",
        ],
      },
      {
        titulo: "Revenda",
        texto: [
          "Leve a Infinite para as suas clientes: semijoias exclusivas, escolhidas conforme a estação, a região e o estilo de quem compra com você. Fale com a gente pelo WhatsApp e conheça as condições para revendedoras.",
        ],
      },
    ],
  },
  {
    slug: "onde-comprar",
    grupo: "institucional",
    titulo: "Onde comprar",
    subtitulo: "No site, no Instagram, pelo WhatsApp, com as nossas consultoras ou pessoalmente.",
    blocos: [
      { titulo: "Neste site oficial", texto: ["Todas as peças, com entrega para todo o Brasil e pagamento seguro."] },
      { titulo: "Instagram", texto: ["Lançamentos em primeira mão em @{instagram}. Compre também pelo direct."] },
      { titulo: "WhatsApp", texto: ["Tire dúvidas, peça fotos e compre com atendimento de pessoa para pessoa: {whatsapp}."] },
      { titulo: "Consultoras de vendas", texto: ["Prefere um atendimento mais personalizado? Nossas consultoras levam as peças até você. Chame no WhatsApp para falar com uma delas."] },
      { titulo: "Endereço", texto: ["{loja} · {endereco}"] },
    ],
  },
  {
    slug: "contato",
    grupo: "institucional",
    titulo: "Fale com a loja",
    subtitulo: "Dúvidas sobre peças, pedidos, trocas, consertos ou revenda.",
    blocos: [
      {
        titulo: "Atendimento",
        lista: ["WhatsApp: {whatsapp}", "Instagram: @{instagram}", "E-mail: {email}"],
      },
      { texto: ["Se já comprou, tenha à mão o código do pedido (ele aparece na confirmação da compra)."] },
      CONTATO,
    ],
  },
  {
    slug: "seja-revendedora",
    grupo: "institucional",
    titulo: "Seja revendedora",
    subtitulo: "Revenda as semijoias da {loja} com maleta em consignado e atendimento direto com a loja.",
    blocos: [
      {
        titulo: "Como funciona",
        lista: [
          "A maleta é entregue em consignado: as peças continuam sendo da loja até o acerto.",
          "No acerto, a revendedora paga as peças vendidas pelo preço de revenda e devolve as outras.",
          "Peça perdida ou danificada é cobrada.",
        ],
      },
      {
        titulo: "Quero revender",
        texto: [
          "Chame a gente no WhatsApp ({whatsapp}) com seu nome, cidade, Instagram (se tiver) e conte um pouco: já revende? Onde vende? Respondemos com as condições e os próximos passos.",
        ],
      },
    ],
  },
  {
    slug: "entregas",
    grupo: "ajuda",
    titulo: "Envio e entrega",
    subtitulo: "Seu brilho merece chegar perfeito e no prazo: frete, prazos e rastreio.",
    blocos: [
      {
        titulo: "Para onde entregamos",
        texto: [
          "Entregamos em todo o Brasil, com rastreamento. O valor do frete depende do estado de entrega e aparece no checkout, antes da confirmação do pedido.",
          "Comprou pelo Instagram, pelo WhatsApp ou com uma das nossas consultoras? A entrega é combinada direto com você, do jeito mais prático.",
        ],
      },
      {
        titulo: "Formas de entrega",
        lista: ["Envio para todo o Brasil, com código de rastreio.", "Retirada na loja, sem custo de frete (combine o horário pelo WhatsApp)."],
      },
      { titulo: "Frete grátis", texto: ["{gratis}"] },
      {
        titulo: "Prazos",
        lista: [
          "O prazo começa a contar depois da confirmação do pagamento. Pix e cartão são confirmados em instantes; o boleto, após a compensação bancária.",
          "Depois do pagamento, separamos, embalamos e postamos o pedido em até 2 dias úteis.",
          "Em seguida vale o prazo de entrega: {prazoEntrega}. Fins de semana e feriados não contam como dias úteis.",
        ],
      },
      {
        titulo: "Acompanhe seu pedido",
        texto: ["Quando o pedido é enviado, o código de rastreio aparece na página do pedido (Acompanhar pedido, com o código da compra) e também mandamos pelo WhatsApp."],
      },
      {
        titulo: "No recebimento",
        lista: [
          "Confira se a embalagem está lacrada e sem sinais de violação.",
          "Se a embalagem estiver danificada, você pode recusar o recebimento ou fotografar tudo antes de abrir.",
          "Se faltar alguma peça, ou se ela chegou danificada ou diferente do pedido, fale com a loja o quanto antes.",
        ],
      },
      {
        titulo: "Atrasos, extravio e endereço",
        lista: [
          "Confira o endereço antes de confirmar: ele é o que vai para a etiqueta de envio.",
          "Atraso ou extravio: acionamos a transportadora e informamos você sobre o andamento. Se a encomenda não for localizada, reenviamos as peças ou devolvemos o valor pago, à sua escolha.",
          "Encomenda devolvida por endereço incorreto ou ausência no local: avisamos você e reenviamos as peças depois do pagamento de um novo frete ou, se preferir, devolvemos o valor das peças.",
        ],
      },
    ],
  },
  {
    slug: "troca-e-devolucao",
    grupo: "ajuda",
    titulo: "Compra e troca",
    subtitulo: "Seus direitos, a garantia das peças, consertos e como pedir uma troca ou devolução.",
    blocos: [
      {
        titulo: "Direito de arrependimento: 7 dias",
        texto: [
          "Em compras pela internet, você pode desistir da compra em até 7 dias corridos a partir do recebimento da peça, sem precisar explicar o motivo (Código de Defesa do Consumidor, art. 49). Nesse caso, devolvemos o valor integral pago, incluindo o frete original.",
          "Peças em promoção ou compradas com cupom têm o mesmo direito.",
        ],
      },
      {
        titulo: "Como a peça deve voltar",
        texto: [
          "Pedimos que a peça volte sem sinais de uso, com a embalagem original e os acessórios que a acompanharam (saquinho, cartela, certificado), para que possamos conferi-la.",
          "Brincos de pino (que atravessam a orelha): por higiene, devem voltar sem uso e na embalagem original, com o lacre ou a cartela de proteção.",
        ],
      },
      {
        titulo: "Peça com defeito",
        texto: [
          "Semijoias são bens duráveis: você tem até 90 dias, a partir do recebimento, para reclamar de defeito (CDC art. 26). Avaliamos a peça e, se o defeito for confirmado, resolvemos em até 30 dias (CDC art. 18); se não for possível, você escolhe entre troca por outra peça igual, devolução do valor pago ou abatimento proporcional do preço.",
          "Desgaste natural pelo uso, contato com perfume, cloro, água do mar ou produtos químicos, quedas e amassados não são defeito de fabricação.",
        ],
      },
      {
        titulo: "Consertos",
        lista: ["Troca de fecho com defeito", "Rebanho da peça", "Reposição de microzircônias"],
        texto: [
          "O prazo do conserto é de até 30 dias úteis a partir do recebimento da peça. Dentro da garantia, o conserto de defeito de fabricação ou do banho não é cobrado; fora dela, informamos o valor antes de começar.",
        ],
      },
      {
        titulo: "Como pedir",
        lista: [
          "Fale com a loja pelo WhatsApp ou e-mail informando o código do pedido.",
          "Diga o motivo (arrependimento, defeito, peça errada) e, se possível, envie fotos.",
          "Enviamos as instruções para a devolução. No arrependimento, no defeito e na peça errada, o frete de volta fica por nossa conta.",
          "Depois que a peça chega e é conferida, fazemos a troca ou o reembolso em até 5 dias, pelo mesmo meio de pagamento usado na compra.",
        ],
      },
      {
        titulo: "Cancelar um pedido",
        texto: [
          "Pedido não pago expira sozinho em {horasReserva} horas e as peças voltam para o estoque. Se o pedido já foi pago, fale com a loja: antes do envio, cancelamos e devolvemos o valor; depois do envio, vale o direito de arrependimento.",
        ],
      },
      CONTATO,
    ],
  },
  {
    slug: "disposicoes-legais",
    grupo: "ajuda",
    titulo: "Disposições legais",
    subtitulo: "Transparência, segurança e confiança em todas as compras.",
    blocos: [
      { ...CONTATO, texto: ["As vendas da {loja}, aqui no site, no Instagram, pelo WhatsApp ou com as nossas consultoras, são feitas por:", ...CONTATO.texto!] },
      {
        titulo: "Qualidade das peças",
        texto: ["Nossas semijoias são escolhidas com cuidado e passam por controle de qualidade. As características de cada peça estão na página dela."],
      },
      {
        titulo: "Compra e pagamento",
        texto: [
          "O pedido é processado depois da confirmação do pagamento. Preço, frete, descontos e parcelas aparecem no checkout antes da confirmação. Os dados do cartão são digitados no ambiente do Mercado Pago e não ficam guardados na loja.",
        ],
      },
      {
        titulo: "Legislação",
        texto: [
          "Esta loja segue o Código de Defesa do Consumidor (Lei 8.078/1990), o Decreto 7.962/2013 (comércio eletrônico), a Lei Geral de Proteção de Dados (Lei 13.709/2018) e o Marco Civil da Internet (Lei 12.965/2014).",
        ],
      },
    ],
  },
  {
    slug: "termos",
    grupo: "ajuda",
    titulo: "Termos de uso",
    versao: "Versão 2026-11-07",
    blocos: [
      { ...CONTATO, titulo: "Quem somos", texto: ["Esta loja online, {loja}, é operada por:", ...CONTATO.texto!, "Ao navegar ou comprar no site, você concorda com estes termos."] },
      {
        titulo: "Compra sem cadastro",
        texto: ["Você compra sem criar conta: basta informar nome, e-mail, WhatsApp e endereço de entrega no checkout. Os dados devem ser verdadeiros, porque são usados para entregar e para falar com você sobre o pedido."],
      },
      {
        titulo: "Peças, fotos e estoque",
        lista: [
          "As informações de cada peça estão na página do produto. Cor e brilho podem variar um pouco conforme a tela e a iluminação.",
          "As peças estão sujeitas à disponibilidade de estoque. A compra só é garantida depois da confirmação do pagamento.",
          "Também vendemos pelo Instagram, pelo WhatsApp e por consultoras; nessas compras valem estes mesmos termos.",
        ],
      },
      {
        titulo: "Garantia e cuidados",
        texto: [
          "Toda peça tem a garantia legal de 90 dias contra defeitos de fabricação e do banho. Não são defeito o desgaste natural do banho pelo uso, nem danos por queda, amassado, atrito ou contato com produtos químicos.",
          "Para o brilho durar: evite perfumes, cremes, cloro e água do mar; tire a peça para fazer atividade física e tomar banho; guarde-a em local seco, separada das outras.",
        ],
      },
      {
        titulo: "Preços e cupons",
        texto: [
          "O valor que vale para a sua compra é o mostrado no checkout, recalculado no momento do pedido. Cupons têm regras próprias (validade, valor mínimo e limite de usos); um cupom por pedido.",
          "Em caso de erro evidente de preço ou de cadastro, avisamos você antes do envio e oferecemos a confirmação pelo valor correto ou o cancelamento com devolução integral.",
        ],
      },
      {
        titulo: "Pagamento",
        lista: [
          "Pix: aprovado na hora.",
          "Cartão de crédito{parcelas}, processado pelo Mercado Pago.",
          "Boleto, pelo Mercado Pago: o pedido é confirmado após a compensação bancária.",
          "Ou combine o pagamento pelo WhatsApp.",
        ],
      },
      {
        titulo: "Reserva do pedido",
        texto: ["As peças ficam reservadas por {horasReserva} horas enquanto aguardamos o pagamento. Depois disso, o pedido não pago é cancelado e as peças voltam para o estoque."],
      },
      {
        titulo: "Uso do site e conteúdo",
        texto: ["Fotos, textos, marca e identidade visual da {loja} não podem ser copiados ou usados sem autorização. Estes termos seguem a legislação brasileira, e você pode buscar seus direitos no foro do seu domicílio."],
      },
    ],
  },
  {
    slug: "privacidade",
    grupo: "ajuda",
    titulo: "Política de privacidade",
    versao: "Versão 2026-11-07",
    blocos: [
      { ...CONTATO, titulo: "Quem cuida dos seus dados", texto: ["O controlador dos dados pessoais tratados neste site, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018), é:", ...CONTATO.texto!] },
      {
        titulo: "Quais dados coletamos",
        texto: [
          "No checkout: nome, e-mail, WhatsApp, CPF (opcional, para a nota fiscal) e endereço de entrega. No pedido, guardamos as peças, os valores e a forma de pagamento. Não guardamos o número do cartão: ele é digitado no ambiente do Mercado Pago.",
        ],
      },
      {
        titulo: "Para que usamos",
        lista: [
          "Entrega, atendimento e nota fiscal: execução do contrato de compra (LGPD, art. 7º, V).",
          "Guarda de pedidos e notas: cumprimento de obrigação legal e fiscal (art. 7º, II).",
          "Prevenção a fraudes: legítimo interesse (art. 7º, IX).",
        ],
        texto: ["Não vendemos nem compartilhamos seus dados para publicidade."],
      },
      {
        titulo: "Com quem compartilhamos",
        texto: ["Com o Mercado Pago (quando você paga por ele) e com a transportadora, apenas o necessário para cobrar e entregar."],
      },
      {
        titulo: "Cookies e sacola",
        texto: [
          "A sacola fica guardada no seu próprio navegador. O site pode usar ferramentas de estatística e de anúncios (como Google Analytics e Pixel da Meta) para medir visitas e compras.",
        ],
      },
      {
        titulo: "Seus direitos",
        texto: [
          "Você pode, a qualquer momento, pedir acesso, correção, portabilidade, eliminação ou bloqueio dos seus dados (LGPD, art. 18), pelo e-mail {email} ou pelo WhatsApp. Respondemos em até 15 dias. Se não ficar satisfeito, você pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).",
        ],
      },
    ],
  },
];

const BG: Pagina[] = [
  {
    slug: "quem-somos",
    grupo: "institucional",
    titulo: "Quem somos",
    subtitulo: "O tempo passa. A presença fica.",
    blocos: [
      {
        texto: [
          "A {loja} reúne relógios e acessórios que unem elegância, qualidade e personalidade, para homens que valorizam estilo em cada detalhe.",
          "Cada modelo é escolhido pelo acabamento, pelo peso na mão e pela presença no pulso: peças para o dia a dia e para as ocasiões que pedem mais.",
          "Seu estilo. Sua presença. Seu tempo.",
        ],
      },
      {
        titulo: "O que você encontra aqui",
        lista: [
          "Relógios da coleção própria da casa, com caixa e pulseira em aço.",
          "Acessórios para completar o visual: pulseiras, carteiras, cintos, óculos e correntes.",
          "Kits presente, prontos para entregar.",
          "Garantia em todos os relógios e atendimento direto pelo WhatsApp.",
        ],
      },
    ],
  },
  {
    slug: "contato",
    grupo: "institucional",
    titulo: "Atendimento",
    subtitulo: "Dúvidas sobre um modelo, um pedido, troca ou garantia.",
    blocos: [
      { titulo: "Fale com a gente", lista: ["WhatsApp: {whatsapp}", "Instagram: @{instagram}", "E-mail: {email}"] },
      { texto: ["Se já comprou, tenha à mão o código do pedido (ele aparece na confirmação da compra)."] },
      CONTATO,
    ],
  },
  {
    slug: "entregas",
    grupo: "ajuda",
    titulo: "Envio e entrega",
    subtitulo: "Frete, prazos e rastreio do seu pedido.",
    blocos: [
      {
        titulo: "Para onde entregamos",
        texto: ["Entregamos em todo o Brasil, com rastreamento. O valor do frete depende do estado de entrega e aparece no checkout, antes da confirmação do pedido."],
      },
      { titulo: "Formas de entrega", lista: ["Envio para todo o Brasil, com código de rastreio.", "Retirada combinada pelo WhatsApp, sem custo de frete."] },
      { titulo: "Frete grátis", texto: ["{gratis}"] },
      {
        titulo: "Prazos",
        lista: [
          "O prazo começa a contar depois da confirmação do pagamento. Pix e cartão são confirmados em instantes; o boleto, após a compensação bancária.",
          "Depois do pagamento, separamos, embalamos e postamos o pedido em até 2 dias úteis.",
          "Em seguida vale o prazo de entrega: {prazoEntrega}.",
        ],
      },
      { titulo: "Acompanhe seu pedido", texto: ["O código de rastreio aparece na página do pedido (Acompanhar pedido, com o código da compra) assim que ele é enviado."] },
      {
        titulo: "No recebimento",
        lista: [
          "Confira se a embalagem está lacrada. Se estiver danificada, recuse o recebimento ou fotografe tudo antes de abrir.",
          "Se o relógio chegou com defeito ou diferente do pedido, fale com a loja o quanto antes.",
        ],
      },
    ],
  },
  {
    slug: "troca-e-devolucao",
    grupo: "ajuda",
    titulo: "Troca, devolução e garantia",
    subtitulo: "Seus direitos e como pedir uma troca, devolução ou o uso da garantia.",
    blocos: [
      {
        titulo: "Direito de arrependimento: 7 dias",
        texto: [
          "Em compras pela internet, você pode desistir da compra em até 7 dias corridos a partir do recebimento, sem precisar explicar o motivo (Código de Defesa do Consumidor, art. 49). Devolvemos o valor integral pago, incluindo o frete original.",
          "O produto deve voltar sem sinais de uso, com a película de proteção, o estojo, o manual e o certificado que o acompanharam.",
        ],
      },
      {
        titulo: "Garantia",
        texto: [
          "Todo relógio tem garantia contra defeito de fabricação. O prazo de cada modelo aparece na página dele e nunca é menor que a garantia legal de 90 dias (CDC art. 26).",
          "Se o defeito for confirmado, resolvemos em até 30 dias; se não for possível, você escolhe entre troca por um modelo igual, devolução do valor pago ou abatimento proporcional do preço (CDC art. 18).",
          "Não são defeito de fabricação: quedas, pancadas, vidro trincado por impacto, entrada de água além da resistência indicada, desgaste natural da pulseira e da bateria, nem conserto feito fora da loja.",
        ],
      },
      {
        titulo: "Como pedir",
        lista: [
          "Fale com a loja informando o código do pedido e o motivo, de preferência com fotos.",
          "Enviamos as instruções para a devolução. No arrependimento e no defeito, o frete de volta fica por nossa conta.",
          "Depois que o produto chega e é conferido, fazemos a troca ou o reembolso em até 5 dias, pelo mesmo meio de pagamento usado na compra.",
        ],
      },
      {
        titulo: "Cancelar um pedido",
        texto: ["Pedido não pago é cancelado sozinho em {horasReserva} horas. Se já foi pago, fale com a loja: antes do envio, cancelamos e devolvemos o valor; depois, vale o direito de arrependimento."],
      },
      CONTATO,
    ],
  },
  {
    slug: "termos",
    grupo: "ajuda",
    titulo: "Termos de uso",
    versao: "Versão 2026-11-08",
    blocos: [
      { ...CONTATO, titulo: "Quem somos", texto: ["Esta loja online, {loja}, é operada por:", ...CONTATO.texto!, "Ao navegar ou comprar no site, você concorda com estes termos."] },
      { titulo: "Compra sem cadastro", texto: ["Você compra sem criar conta: basta informar nome, e-mail, WhatsApp e endereço de entrega no checkout. Os dados devem ser verdadeiros, porque são usados para entregar e para falar com você sobre o pedido."] },
      {
        titulo: "Produtos e estoque",
        lista: [
          "As características de cada modelo (caixa, pulseira, mostrador, resistência à água e garantia) estão na página dele. Cor e brilho podem variar um pouco conforme a tela.",
          "Os modelos são vendidos em lotes pequenos e estão sujeitos à disponibilidade de estoque. A compra só é garantida depois da confirmação do pagamento.",
        ],
      },
      {
        titulo: "Preços e cupons",
        texto: [
          "O valor que vale para a sua compra é o mostrado no checkout, recalculado no momento do pedido. Cupons têm regras próprias (validade, valor mínimo e limite de usos); um cupom por pedido.",
          "Em caso de erro evidente de preço ou de cadastro, avisamos você antes do envio e oferecemos a confirmação pelo valor correto ou o cancelamento com devolução integral.",
        ],
      },
      {
        titulo: "Pagamento",
        lista: ["Pix: aprovado na hora.", "Cartão de crédito{parcelas}, processado pelo Mercado Pago.", "Boleto, pelo Mercado Pago.", "Ou combine o pagamento pelo WhatsApp."],
      },
      { titulo: "Reserva do pedido", texto: ["Os produtos ficam reservados por {horasReserva} horas enquanto aguardamos o pagamento. Depois disso, o pedido não pago é cancelado."] },
      { titulo: "Uso do site", texto: ["Fotos, textos, marca e identidade visual da {loja} não podem ser copiados sem autorização. Estes termos seguem a legislação brasileira, e você pode buscar seus direitos no foro do seu domicílio."] },
    ],
  },
  {
    slug: "privacidade",
    grupo: "ajuda",
    titulo: "Política de privacidade",
    versao: "Versão 2026-11-08",
    blocos: [
      { ...CONTATO, titulo: "Quem cuida dos seus dados", texto: ["O controlador dos dados pessoais tratados neste site, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018), é:", ...CONTATO.texto!] },
      {
        titulo: "Quais dados coletamos",
        texto: ["No checkout: nome, e-mail, WhatsApp, CPF (opcional, para a nota fiscal) e endereço de entrega. No pedido, guardamos os produtos, os valores e a forma de pagamento. Não guardamos o número do cartão: ele é digitado no ambiente do Mercado Pago."],
      },
      {
        titulo: "Para que usamos",
        lista: [
          "Entrega, atendimento, garantia e nota fiscal: execução do contrato de compra (LGPD, art. 7º, V).",
          "Guarda de pedidos e notas: cumprimento de obrigação legal e fiscal (art. 7º, II).",
          "Prevenção a fraudes: legítimo interesse (art. 7º, IX).",
        ],
        texto: ["Não vendemos nem compartilhamos seus dados para publicidade."],
      },
      { titulo: "Com quem compartilhamos", texto: ["Com o Mercado Pago (quando você paga por ele) e com a transportadora, apenas o necessário para cobrar e entregar."] },
      { titulo: "Cookies e sacola", texto: ["A sacola fica guardada no seu próprio navegador. O site pode usar ferramentas de estatística e de anúncios (como Google Analytics e Pixel da Meta) para medir visitas e compras."] },
      {
        titulo: "Seus direitos",
        texto: ["Você pode pedir acesso, correção, portabilidade, eliminação ou bloqueio dos seus dados (LGPD, art. 18) pelos canais de atendimento. Respondemos em até 15 dias. Se não ficar satisfeito, pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD)."],
      },
    ],
  },
];

const PAGINAS: Record<string, Pagina[]> = { infinite: INFINITE, "bg-imports": BG };

export function paginasDaLoja(slug: string): Pagina[] {
  return PAGINAS[slug] ?? [];
}

function formatarWhatsapp(n: string | null) {
  const d = (n ?? "").replace(/\D/g, "");
  const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : d;
}

/**
 * Troca os placeholders pelos dados atuais da loja (o que muda no painel vale aqui também).
 * Devolve null quando algum dado usado no texto está vazio, para a linha não aparecer pela metade.
 */
export function preencherOuNada(texto: string, loja: Loja): string | null {
  let faltou = false;
  const r = preencher(texto, loja, () => (faltou = true));
  return faltou ? null : r;
}

export function preencher(texto: string, loja: Loja, vazio?: () => void): string {
  const v = visualDaLoja(loja.slug);
  const entrega = loja.frete.entrega;
  const gratis =
    entrega.ativo && entrega.gratisAcimaCentavos != null
      ? `Frete grátis quando o valor das peças, já com o desconto do cupom, chega a ${formatarReais(entrega.gratisAcimaCentavos)}.`
      : "O valor do frete aparece no checkout, antes da confirmação.";
  const mapa: Record<string, string> = {
    loja: loja.nome,
    razao: v.empresa?.razao ?? loja.nome,
    cnpj: v.empresa?.cnpj ?? "",
    endereco: v.empresa?.endereco ?? "",
    email: loja.email ?? "",
    whatsapp: formatarWhatsapp(loja.whatsapp),
    instagram: (loja.instagram ?? "").replace(/^@/, ""),
    gratis,
    prazoEntrega: entrega.prazo,
    horasReserva: String(loja.horasReserva),
    parcelas: loja.parcelasSemJuros > 1 ? ` em até ${loja.parcelasSemJuros}x sem juros` : "",
  };
  return texto.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = mapa[k] ?? "";
    // "parcelas" vazio é normal (sem parcelamento sem juros); os outros indicam dado que falta
    if (!v && k !== "parcelas") vazio?.();
    return v;
  });
}
