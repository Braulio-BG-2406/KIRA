CREATE TABLE "categorias" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"nome" text NOT NULL,
	"slug" text NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"nome" text NOT NULL,
	"email" text,
	"telefone" text,
	"documento" text,
	"endereco" jsonb,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compra_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"compra_id" integer NOT NULL,
	"variante_id" integer NOT NULL,
	"quantidade" integer NOT NULL,
	"custo_unit_centavos" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compras" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"fornecedor_id" integer,
	"status" text DEFAULT 'rascunho' NOT NULL,
	"frete_centavos" integer DEFAULT 0 NOT NULL,
	"total_centavos" integer DEFAULT 0 NOT NULL,
	"vencimento" date,
	"observacoes" text,
	"recebida_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"codigo" text NOT NULL,
	"tipo" text NOT NULL,
	"valor" integer NOT NULL,
	"minimo_centavos" integer DEFAULT 0 NOT NULL,
	"valido_ate" date,
	"limite_usos" integer,
	"usos" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fornecedores" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"nome" text NOT NULL,
	"contato" text,
	"telefone" text,
	"email" text,
	"documento" text,
	"observacoes" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lancamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"tipo" text NOT NULL,
	"categoria" text NOT NULL,
	"descricao" text NOT NULL,
	"valor_centavos" integer NOT NULL,
	"vencimento" date NOT NULL,
	"pago_em" timestamp with time zone,
	"status" text DEFAULT 'pendente' NOT NULL,
	"pedido_id" integer,
	"compra_id" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lojas" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"nome" text NOT NULL,
	"slogan" text,
	"sobre" text,
	"logo_url" text,
	"cor_primaria" text DEFAULT '#111827' NOT NULL,
	"cor_destaque" text DEFAULT '#b08d57' NOT NULL,
	"whatsapp" text,
	"instagram" text,
	"email" text,
	"pix_chave" text,
	"pix_nome" text,
	"pix_cidade" text,
	"frete" jsonb DEFAULT '{"retirada":{"ativo":true,"endereco":""},"entrega":{"ativo":true,"valorPadraoCentavos":2500,"porUF":{},"gratisAcimaCentavos":null,"prazo":"3 a 10 dias úteis"}}'::jsonb NOT NULL,
	"estoque_minimo" integer DEFAULT 3 NOT NULL,
	"horas_reserva" integer DEFAULT 48 NOT NULL,
	"seq_pedido" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lojas_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "movimentos_estoque" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"variante_id" integer NOT NULL,
	"quantidade" integer NOT NULL,
	"tipo" text NOT NULL,
	"nota" text,
	"pedido_id" integer,
	"compra_id" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedido_historico" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer NOT NULL,
	"status" text NOT NULL,
	"nota" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedido_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer NOT NULL,
	"variante_id" integer,
	"produto_nome" text NOT NULL,
	"variante_nome" text NOT NULL,
	"sku" text,
	"quantidade" integer NOT NULL,
	"preco_unit_centavos" integer NOT NULL,
	"custo_unit_centavos" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedidos" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"numero" integer NOT NULL,
	"codigo" text NOT NULL,
	"cliente_id" integer,
	"canal" text DEFAULT 'site' NOT NULL,
	"status" text DEFAULT 'aguardando_pagamento' NOT NULL,
	"forma_pagamento" text NOT NULL,
	"status_pagamento" text DEFAULT 'pendente' NOT NULL,
	"subtotal_centavos" integer NOT NULL,
	"frete_centavos" integer DEFAULT 0 NOT NULL,
	"desconto_centavos" integer DEFAULT 0 NOT NULL,
	"total_centavos" integer NOT NULL,
	"cupom_codigo" text,
	"entrega" jsonb NOT NULL,
	"codigo_rastreio" text,
	"observacoes" text,
	"mp_preferencia_id" text,
	"mp_pagamento_id" text,
	"pago_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pedidos_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "produto_imagens" (
	"id" serial PRIMARY KEY NOT NULL,
	"produto_id" integer NOT NULL,
	"url" text NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "produtos" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"categoria_id" integer,
	"nome" text NOT NULL,
	"slug" text NOT NULL,
	"descricao" text DEFAULT '' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"destaque" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessoes" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"expira_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "variantes" (
	"id" serial PRIMARY KEY NOT NULL,
	"produto_id" integer NOT NULL,
	"nome" text DEFAULT 'Padrão' NOT NULL,
	"sku" text,
	"preco_centavos" integer NOT NULL,
	"preco_de_centavos" integer,
	"custo_centavos" integer DEFAULT 0 NOT NULL,
	"estoque" integer DEFAULT 0 NOT NULL,
	"peso_gramas" integer,
	"ativo" boolean DEFAULT true NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compra_itens" ADD CONSTRAINT "compra_itens_compra_id_compras_id_fk" FOREIGN KEY ("compra_id") REFERENCES "public"."compras"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compra_itens" ADD CONSTRAINT "compra_itens_variante_id_variantes_id_fk" FOREIGN KEY ("variante_id") REFERENCES "public"."variantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras" ADD CONSTRAINT "compras_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compras" ADD CONSTRAINT "compras_fornecedor_id_fornecedores_id_fk" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."fornecedores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cupons" ADD CONSTRAINT "cupons_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fornecedores" ADD CONSTRAINT "fornecedores_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_compra_id_compras_id_fk" FOREIGN KEY ("compra_id") REFERENCES "public"."compras"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentos_estoque" ADD CONSTRAINT "movimentos_estoque_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentos_estoque" ADD CONSTRAINT "movimentos_estoque_variante_id_variantes_id_fk" FOREIGN KEY ("variante_id") REFERENCES "public"."variantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimentos_estoque" ADD CONSTRAINT "movimentos_estoque_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_historico" ADD CONSTRAINT "pedido_historico_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_variante_id_variantes_id_fk" FOREIGN KEY ("variante_id") REFERENCES "public"."variantes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produto_imagens" ADD CONSTRAINT "produto_imagens_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variantes" ADD CONSTRAINT "variantes_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categorias_loja_slug" ON "categorias" USING btree ("loja_id","slug");--> statement-breakpoint
CREATE INDEX "clientes_loja" ON "clientes" USING btree ("loja_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cupons_loja_codigo" ON "cupons" USING btree ("loja_id","codigo");--> statement-breakpoint
CREATE INDEX "lancamentos_loja_venc" ON "lancamentos" USING btree ("loja_id","vencimento");--> statement-breakpoint
CREATE UNIQUE INDEX "lancamentos_pedido" ON "lancamentos" USING btree ("pedido_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lancamentos_compra" ON "lancamentos" USING btree ("compra_id");--> statement-breakpoint
CREATE INDEX "movimentos_loja_criado" ON "movimentos_estoque" USING btree ("loja_id","criado_em");--> statement-breakpoint
CREATE UNIQUE INDEX "pedidos_loja_numero" ON "pedidos" USING btree ("loja_id","numero");--> statement-breakpoint
CREATE INDEX "pedidos_loja_status" ON "pedidos" USING btree ("loja_id","status");--> statement-breakpoint
CREATE INDEX "pedidos_loja_criado" ON "pedidos" USING btree ("loja_id","criado_em");--> statement-breakpoint
CREATE UNIQUE INDEX "produtos_loja_slug" ON "produtos" USING btree ("loja_id","slug");--> statement-breakpoint
CREATE INDEX "produtos_loja" ON "produtos" USING btree ("loja_id");--> statement-breakpoint
CREATE INDEX "variantes_produto" ON "variantes" USING btree ("produto_id");