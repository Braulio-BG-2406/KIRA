ALTER TABLE "lojas" ADD COLUMN "tema" text DEFAULT 'elegante' NOT NULL;--> statement-breakpoint
ALTER TABLE "lojas" ADD COLUMN "desconto_pix_pct" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lojas" ADD COLUMN "parcelas_sem_juros" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "desconto_pix_centavos" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "produtos" ADD COLUMN "marca" text;--> statement-breakpoint
ALTER TABLE "produtos" ADD COLUMN "especificacoes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "produtos" ADD COLUMN "garantia" text;--> statement-breakpoint
ALTER TABLE "produtos" ADD COLUMN "itens_inclusos" text;--> statement-breakpoint
ALTER TABLE "variantes" ADD COLUMN "codigo_barras" text;