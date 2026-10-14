import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;
/** o banco ou uma transação aberta */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0] | DB;

const globalDb = globalThis as unknown as { __pool?: Pool; __db?: DB };

function criar(): DB {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  globalDb.__pool = pool;
  return drizzle(pool, { schema });
}

// reaproveita a conexão entre recargas do "next dev"
export const db: DB = globalDb.__db ?? (globalDb.__db = criar());

export async function fecharDb() {
  await globalDb.__pool?.end();
  globalDb.__pool = undefined;
  globalDb.__db = undefined;
}

export { schema };
