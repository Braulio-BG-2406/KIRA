import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { ErroNegocio } from "./erros";

export const PASTA_UPLOADS = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");

// sem SVG: pode carregar script
export const TIPOS_IMAGEM: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function assinaturaConfere(bytes: Buffer, tipo: string): boolean {
  const hex = bytes.subarray(0, 12).toString("hex");
  if (tipo === "image/jpeg") return hex.startsWith("ffd8ff");
  if (tipo === "image/png") return hex.startsWith("89504e47");
  if (tipo === "image/gif") return hex.startsWith("47494638");
  if (tipo === "image/webp") return hex.startsWith("52494646") && bytes.subarray(8, 12).toString() === "WEBP";
  return false;
}

/** guarda a foto e devolve a URL pública (/uploads/...) */
export async function salvarImagem(arquivo: File): Promise<string> {
  const ext = TIPOS_IMAGEM[arquivo.type];
  if (!ext) throw new ErroNegocio("Envie fotos em JPG, PNG, WEBP ou GIF.");
  if (arquivo.size > 8 * 1024 * 1024) throw new ErroNegocio("Cada foto pode ter no máximo 8 MB.");
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  if (!assinaturaConfere(bytes, arquivo.type)) throw new ErroNegocio("O arquivo não parece ser uma imagem válida.");
  await mkdir(PASTA_UPLOADS, { recursive: true });
  const nome = `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${ext}`;
  await writeFile(path.join(PASTA_UPLOADS, nome), bytes);
  return `/uploads/${nome}`;
}

export async function apagarImagem(url: string) {
  const nome = path.basename(url);
  if (!url.startsWith("/uploads/") || !/^[\w.-]+$/.test(nome)) return;
  await unlink(path.join(PASTA_UPLOADS, nome)).catch(() => {});
}
