import { defineConfig } from "@playwright/test";

const PORTA = 3200;
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://lojas:lojas@localhost:5432/lojas_e2e";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/preparar.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: { baseURL: `http://localhost:${PORTA}`, locale: "pt-BR", timezoneId: "America/Sao_Paulo", screenshot: "only-on-failure" },
  webServer: {
    // roda o build de produção (rode "npm run build" antes)
    command: `npx next start -p ${PORTA}`,
    port: PORTA,
    reuseExistingServer: false,
    env: {
      DATABASE_URL,
      APP_URL: `http://localhost:${PORTA}`,
      KIRA_API_TOKEN: "token-de-teste-da-kira-123",
      UPLOAD_DIR: "./test-results/uploads",
    },
  },
});
