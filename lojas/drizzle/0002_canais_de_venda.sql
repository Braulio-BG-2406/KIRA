CREATE TABLE "anuncios" (
	"id" serial PRIMARY KEY NOT NULL,
	"canal_id" integer NOT NULL,
	"variante_id" integer NOT NULL,
	"externo_id" text NOT NULL,
	"externo_variante_id" text DEFAULT '' NOT NULL,
	"link" text,
	"ultimo_estoque_enviado" integer,
	"ultimo_preco_enviado" integer,
	"erro" text,
	"sincronizado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canais" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"tipo" text NOT NULL,
	"credenciais" jsonb,
	"config" jsonb DEFAULT '{"sincronizarPreco":true,"acrescimoPct":0,"tipoAnuncio":"gold_special"}'::jsonb NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"ultimo_erro" text,
	"sincronizado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lojas" ADD COLUMN "rastreamento" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "canal_pedido_id" text;--> statement-breakpoint
ALTER TABLE "anuncios" ADD CONSTRAINT "anuncios_canal_id_canais_id_fk" FOREIGN KEY ("canal_id") REFERENCES "public"."canais"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anuncios" ADD CONSTRAINT "anuncios_variante_id_variantes_id_fk" FOREIGN KEY ("variante_id") REFERENCES "public"."variantes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canais" ADD CONSTRAINT "canais_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "anuncios_canal_variante" ON "anuncios" USING btree ("canal_id","variante_id");--> statement-breakpoint
CREATE UNIQUE INDEX "anuncios_canal_externo" ON "anuncios" USING btree ("canal_id","externo_id","externo_variante_id");--> statement-breakpoint
CREATE UNIQUE INDEX "canais_loja_tipo" ON "canais" USING btree ("loja_id","tipo");--> statement-breakpoint
CREATE UNIQUE INDEX "pedidos_canal_externo" ON "pedidos" USING btree ("loja_id","canal","canal_pedido_id");