import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  jsonb,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// Todos os valores em dinheiro são inteiros em centavos.

export type ConfigFrete = {
  retirada: { ativo: boolean; endereco: string };
  entrega: {
    ativo: boolean;
    valorPadraoCentavos: number;
    /** valor por UF; a UF que não estiver aqui usa o valor padrão */
    porUF: Record<string, number>;
    gratisAcimaCentavos: number | null;
    prazo: string;
  };
};

export const FRETE_PADRAO: ConfigFrete = {
  retirada: { ativo: true, endereco: "" },
  entrega: { ativo: true, valorPadraoCentavos: 2500, porUF: {}, gratisAcimaCentavos: null, prazo: "3 a 10 dias úteis" },
};

export type Endereco = {
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
};

export type Entrega = {
  metodo: "retirada" | "entrega";
  descricao: string;
  prazo?: string;
  endereco?: Endereco;
};

const criadoEm = () => timestamp("criado_em", { withTimezone: true }).notNull().defaultNow();

export const lojas = pgTable("lojas", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  nome: text("nome").notNull(),
  slogan: text("slogan"),
  sobre: text("sobre"),
  logoUrl: text("logo_url"),
  corPrimaria: text("cor_primaria").notNull().default("#111827"),
  corDestaque: text("cor_destaque").notNull().default("#b08d57"),
  whatsapp: text("whatsapp"),
  instagram: text("instagram"),
  email: text("email"),
  pixChave: text("pix_chave"),
  pixNome: text("pix_nome"),
  pixCidade: text("pix_cidade"),
  frete: jsonb("frete").$type<ConfigFrete>().notNull().default(FRETE_PADRAO),
  estoqueMinimo: integer("estoque_minimo").notNull().default(3),
  /** horas até um pedido não pago ser cancelado e o estoque voltar */
  horasReserva: integer("horas_reserva").notNull().default(48),
  seqPedido: integer("seq_pedido").notNull().default(0),
  criadoEm: criadoEm(),
});

export const categorias = pgTable(
  "categorias",
  {
    id: serial("id").primaryKey(),
    lojaId: integer("loja_id").notNull().references(() => lojas.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    slug: text("slug").notNull(),
    ordem: integer("ordem").notNull().default(0),
  },
  (t) => [uniqueIndex("categorias_loja_slug").on(t.lojaId, t.slug)],
);

export const produtos = pgTable(
  "produtos",
  {
    id: serial("id").primaryKey(),
    lojaId: integer("loja_id").notNull().references(() => lojas.id, { onDelete: "cascade" }),
    categoriaId: integer("categoria_id").references(() => categorias.id, { onDelete: "set null" }),
    nome: text("nome").notNull(),
    slug: text("slug").notNull(),
    descricao: text("descricao").notNull().default(""),
    ativo: boolean("ativo").notNull().default(true),
    destaque: boolean("destaque").notNull().default(false),
    criadoEm: criadoEm(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("produtos_loja_slug").on(t.lojaId, t.slug), index("produtos_loja").on(t.lojaId)],
);

export const produtoImagens = pgTable("produto_imagens", {
  id: serial("id").primaryKey(),
  produtoId: integer("produto_id").notNull().references(() => produtos.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  ordem: integer("ordem").notNull().default(0),
});

export const variantes = pgTable(
  "variantes",
  {
    id: serial("id").primaryKey(),
    produtoId: integer("produto_id").notNull().references(() => produtos.id, { onDelete: "cascade" }),
    nome: text("nome").notNull().default("Padrão"),
    sku: text("sku"),
    precoCentavos: integer("preco_centavos").notNull(),
    /** preço "de" riscado na vitrine */
    precoDeCentavos: integer("preco_de_centavos"),
    custoCentavos: integer("custo_centavos").notNull().default(0),
    estoque: integer("estoque").notNull().default(0),
    pesoGramas: integer("peso_gramas"),
    ativo: boolean("ativo").notNull().default(true),
    ordem: integer("ordem").notNull().default(0),
  },
  (t) => [index("variantes_produto").on(t.produtoId)],
);

export const clientes = pgTable(
  "clientes",
  {
    id: serial("id").primaryKey(),
    lojaId: integer("loja_id").notNull().references(() => lojas.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    email: text("email"),
    telefone: text("telefone"),
    documento: text("documento"),
    endereco: jsonb("endereco").$type<Endereco>(),
    observacoes: text("observacoes"),
    criadoEm: criadoEm(),
  },
  (t) => [index("clientes_loja").on(t.lojaId)],
);

export type StatusPedido = "aguardando_pagamento" | "pago" | "separacao" | "enviado" | "entregue" | "cancelado";
export type StatusPagamento = "pendente" | "aprovado" | "recusado" | "estornado";
export type CanalVenda = "site" | "whatsapp" | "instagram" | "loja_fisica" | "outro";
export type FormaPagamento = "pix" | "mercadopago" | "whatsapp" | "dinheiro" | "cartao" | "transferencia" | "outro";

export const pedidos = pgTable(
  "pedidos",
  {
    id: serial("id").primaryKey(),
    lojaId: integer("loja_id").notNull().references(() => lojas.id, { onDelete: "cascade" }),
    numero: integer("numero").notNull(),
    /** código público para o cliente acompanhar o pedido */
    codigo: text("codigo").notNull().unique(),
    clienteId: integer("cliente_id").references(() => clientes.id, { onDelete: "set null" }),
    canal: text("canal").$type<CanalVenda>().notNull().default("site"),
    status: text("status").$type<StatusPedido>().notNull().default("aguardando_pagamento"),
    formaPagamento: text("forma_pagamento").$type<FormaPagamento>().notNull(),
    statusPagamento: text("status_pagamento").$type<StatusPagamento>().notNull().default("pendente"),
    subtotalCentavos: integer("subtotal_centavos").notNull(),
    freteCentavos: integer("frete_centavos").notNull().default(0),
    descontoCentavos: integer("desconto_centavos").notNull().default(0),
    totalCentavos: integer("total_centavos").notNull(),
    cupomCodigo: text("cupom_codigo"),
    entrega: jsonb("entrega").$type<Entrega>().notNull(),
    codigoRastreio: text("codigo_rastreio"),
    observacoes: text("observacoes"),
    mpPreferenciaId: text("mp_preferencia_id"),
    mpPagamentoId: text("mp_pagamento_id"),
    pagoEm: timestamp("pago_em", { withTimezone: true }),
    criadoEm: criadoEm(),
    atualizadoEm: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("pedidos_loja_numero").on(t.lojaId, t.numero),
    index("pedidos_loja_status").on(t.lojaId, t.status),
    index("pedidos_loja_criado").on(t.lojaId, t.criadoEm),
  ],
);

export const pedidoItens = pgTable("pedido_itens", {
  id: serial("id").primaryKey(),
  pedidoId: integer("pedido_id").notNull().references(() => pedidos.id, { onDelete: "cascade" }),
  varianteId: integer("variante_id").references(() => variantes.id, { onDelete: "set null" }),
  produtoNome: text("produto_nome").notNull(),
  varianteNome: text("variante_nome").notNull(),
  sku: text("sku"),
  quantidade: integer("quantidade").notNull(),
  precoUnitCentavos: integer("preco_unit_centavos").notNull(),
  custoUnitCentavos: integer("custo_unit_centavos").notNull().default(0),
});

export const pedidoHistorico = pgTable("pedido_historico", {
  id: serial("id").primaryKey(),
  pedidoId: integer("pedido_id").notNull().references(() => pedidos.id, { onDelete: "cascade" }),
  status: text("status").$type<StatusPedido>().notNull(),
  nota: text("nota"),
  criadoEm: criadoEm(),
});

export type TipoMovimento = "entrada" | "saida" | "ajuste" | "venda" | "cancelamento" | "compra";

export const movimentosEstoque = pgTable(
  "movimentos_estoque",
  {
    id: serial("id").primaryKey(),
    lojaId: integer("loja_id").notNull().references(() => lojas.id, { onDelete: "cascade" }),
    varianteId: integer("variante_id").notNull().references(() => variantes.id, { onDelete: "cascade" }),
    /** positivo entra, negativo sai */
    quantidade: integer("quantidade").notNull(),
    tipo: text("tipo").$type<TipoMovimento>().notNull(),
    nota: text("nota"),
    pedidoId: integer("pedido_id").references(() => pedidos.id, { onDelete: "set null" }),
    compraId: integer("compra_id"),
    criadoEm: criadoEm(),
  },
  (t) => [index("movimentos_loja_criado").on(t.lojaId, t.criadoEm)],
);

export const fornecedores = pgTable("fornecedores", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").notNull().references(() => lojas.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  contato: text("contato"),
  telefone: text("telefone"),
  email: text("email"),
  documento: text("documento"),
  observacoes: text("observacoes"),
  criadoEm: criadoEm(),
});

export type StatusCompra = "rascunho" | "recebida" | "cancelada";

export const compras = pgTable("compras", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").notNull().references(() => lojas.id, { onDelete: "cascade" }),
  fornecedorId: integer("fornecedor_id").references(() => fornecedores.id, { onDelete: "set null" }),
  status: text("status").$type<StatusCompra>().notNull().default("rascunho"),
  freteCentavos: integer("frete_centavos").notNull().default(0),
  totalCentavos: integer("total_centavos").notNull().default(0),
  vencimento: date("vencimento"),
  observacoes: text("observacoes"),
  recebidaEm: timestamp("recebida_em", { withTimezone: true }),
  criadoEm: criadoEm(),
});

export const compraItens = pgTable("compra_itens", {
  id: serial("id").primaryKey(),
  compraId: integer("compra_id").notNull().references(() => compras.id, { onDelete: "cascade" }),
  varianteId: integer("variante_id").notNull().references(() => variantes.id, { onDelete: "cascade" }),
  quantidade: integer("quantidade").notNull(),
  custoUnitCentavos: integer("custo_unit_centavos").notNull(),
});

export type TipoLancamento = "receita" | "despesa";
export type StatusLancamento = "pendente" | "pago" | "cancelado";

export const lancamentos = pgTable(
  "lancamentos",
  {
    id: serial("id").primaryKey(),
    lojaId: integer("loja_id").notNull().references(() => lojas.id, { onDelete: "cascade" }),
    tipo: text("tipo").$type<TipoLancamento>().notNull(),
    categoria: text("categoria").notNull(),
    descricao: text("descricao").notNull(),
    valorCentavos: integer("valor_centavos").notNull(),
    vencimento: date("vencimento").notNull(),
    pagoEm: timestamp("pago_em", { withTimezone: true }),
    status: text("status").$type<StatusLancamento>().notNull().default("pendente"),
    pedidoId: integer("pedido_id").references(() => pedidos.id, { onDelete: "set null" }),
    compraId: integer("compra_id").references(() => compras.id, { onDelete: "set null" }),
    criadoEm: criadoEm(),
  },
  (t) => [
    index("lancamentos_loja_venc").on(t.lojaId, t.vencimento),
    uniqueIndex("lancamentos_pedido").on(t.pedidoId),
    uniqueIndex("lancamentos_compra").on(t.compraId),
  ],
);

export type TipoCupom = "percentual" | "fixo";

export const cupons = pgTable(
  "cupons",
  {
    id: serial("id").primaryKey(),
    lojaId: integer("loja_id").notNull().references(() => lojas.id, { onDelete: "cascade" }),
    codigo: text("codigo").notNull(),
    tipo: text("tipo").$type<TipoCupom>().notNull(),
    /** percentual: 0–100; fixo: centavos */
    valor: integer("valor").notNull(),
    minimoCentavos: integer("minimo_centavos").notNull().default(0),
    validoAte: date("valido_ate"),
    limiteUsos: integer("limite_usos"),
    usos: integer("usos").notNull().default(0),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: criadoEm(),
  },
  (t) => [uniqueIndex("cupons_loja_codigo").on(t.lojaId, t.codigo)],
);

export const usuarios = pgTable("usuarios", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  email: text("email").notNull().unique(),
  senhaHash: text("senha_hash").notNull(),
  criadoEm: criadoEm(),
});

export const sessoes = pgTable("sessoes", {
  /** sha256 do token do cookie */
  id: text("id").primaryKey(),
  usuarioId: integer("usuario_id").notNull().references(() => usuarios.id, { onDelete: "cascade" }),
  expiraEm: timestamp("expira_em", { withTimezone: true }).notNull(),
});

export type Loja = typeof lojas.$inferSelect;
export type Produto = typeof produtos.$inferSelect;
export type Variante = typeof variantes.$inferSelect;
export type Pedido = typeof pedidos.$inferSelect;
export type Cliente = typeof clientes.$inferSelect;
export type Cupom = typeof cupons.$inferSelect;
