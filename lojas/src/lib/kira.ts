import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/** confere o "Authorization: Bearer <KIRA_API_TOKEN>" das chamadas da Kira */
export function kiraAutorizada(req: Request): boolean {
  const esperado = process.env.KIRA_API_TOKEN;
  if (!esperado || esperado.length < 16) return false;
  const recebido = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = createHash("sha256").update(recebido).digest();
  const b = createHash("sha256").update(esperado).digest();
  return timingSafeEqual(a, b);
}
