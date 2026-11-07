import { execSync } from "node:child_process";

// banco limpo com as duas lojas de exemplo antes de cada rodada
export default function preparar() {
  const env = {
    ...process.env,
    DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgres://lojas:lojas@localhost:5432/lojas_e2e",
    ADMIN_EMAIL: "admin@teste.local",
    ADMIN_SENHA: "senha-de-teste-e2e",
  };
  execSync(`psql "${env.DATABASE_URL}" -q -c "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;"`, { env, stdio: "inherit" });
  execSync("npx tsx scripts/migrate.ts", { env, stdio: "inherit" });
  execSync("npx tsx scripts/seed.ts --demo", { env, stdio: "inherit" });
}
