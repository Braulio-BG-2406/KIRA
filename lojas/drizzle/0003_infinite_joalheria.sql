-- Infinite Semijoias: visual e dados do site antigo (infinitesemijoias.store).
-- Só mexe na loja "infinite" se ela já existir (numa instalação nova, o seed já a cria assim).
-- Contatos só são preenchidos se ainda estiverem vazios, para não apagar o que foi ajustado no painel.
UPDATE "lojas" SET
  "nome" = 'Infinite Semijoias',
  "slogan" = 'Semijoias para todos os seus momentos.',
  "sobre" = 'Sofisticação, exclusividade e estilo: semijoias com banho de ouro 18k, coleções limitadas e garantia em cada peça.',
  "cor_primaria" = '#0b0b0c',
  "cor_destaque" = '#b89a67',
  "tema" = 'joalheria',
  "whatsapp" = COALESCE(NULLIF("whatsapp", ''), '5531975001789'),
  "instagram" = COALESCE(NULLIF("instagram", ''), 'infinitesemijoiasoficial'),
  "email" = COALESCE(NULLIF("email", ''), 'infinitesemijoiasoficial@gmail.com'),
  "frete" = jsonb_set(
    -- frete grátis a partir de R$ 300 em peças, como no site antigo (se ainda não houver um valor)
    jsonb_set(
      "frete",
      '{entrega,gratisAcimaCentavos}',
      CASE WHEN jsonb_typeof("frete"->'entrega'->'gratisAcimaCentavos') = 'number' THEN "frete"->'entrega'->'gratisAcimaCentavos' ELSE '30000'::jsonb END,
      true
    ),
    '{retirada,endereco}',
    to_jsonb(COALESCE(NULLIF("frete"->'retirada'->>'endereco', ''), 'Rua Vereador Genésio Alves do Couto, 160 - Cidade Nova, Juatuba/MG')),
    true
  )
WHERE "slug" = 'infinite';
--> statement-breakpoint
-- coleções na ordem do site antigo (as que já existem só mudam de posição)
INSERT INTO "categorias" ("loja_id", "nome", "slug", "ordem")
SELECT l."id", c."nome", c."slug", c."ordem"
FROM "lojas" l
CROSS JOIN (VALUES
  ('Brincos', 'brincos', 0),
  ('Colares', 'colares', 1),
  ('Linha Masculina', 'linha-masculina', 2),
  ('Conjuntos', 'conjuntos', 3),
  ('Anéis', 'aneis', 4),
  ('Pulseiras', 'pulseiras', 5),
  ('Acessórios de Luxo', 'acessorios-de-luxo', 6),
  ('Tornozeleiras', 'tornozeleiras', 7),
  ('Piercings', 'piercings', 8)
) AS c("nome", "slug", "ordem")
WHERE l."slug" = 'infinite'
ON CONFLICT ("loja_id", "slug") DO UPDATE SET "ordem" = EXCLUDED."ordem";
