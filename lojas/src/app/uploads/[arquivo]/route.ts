import { readFile } from "node:fs/promises";
import path from "node:path";
import { PASTA_UPLOADS, TIPOS_IMAGEM } from "@/lib/uploads";

// extensão -> tipo, a partir da mesma lista aceita no envio (sem SVG)
const TIPOS = Object.fromEntries(Object.entries(TIPOS_IMAGEM).map(([tipo, ext]) => [ext, tipo]));

/** serve as fotos enviadas pelo painel (e as importadas), guardadas em UPLOAD_DIR */
export async function GET(_req: Request, { params }: { params: Promise<{ arquivo: string }> }) {
  const { arquivo } = await params;
  const ext = path.extname(arquivo).slice(1).toLowerCase();
  // só nomes simples: nada de ../ nem subpastas
  if (!/^[\w.-]+$/.test(arquivo) || arquivo.startsWith(".") || !TIPOS[ext]) return new Response("Não encontrado", { status: 404 });
  try {
    const bytes = await readFile(path.join(PASTA_UPLOADS, arquivo));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": TIPOS[ext],
        // o nome do arquivo muda a cada envio: pode guardar por muito tempo
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Não encontrado", { status: 404 });
  }
}
