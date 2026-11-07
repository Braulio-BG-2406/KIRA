import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { pedidos } from "@/db/schema";
import { buscarLoja } from "@/lib/lojas";
import { criarPedido, ErroNegocio } from "@/lib/pedidos";
import { UFS } from "@/lib/frete";
import { criarPreferencia, tokenMercadoPago } from "@/lib/mercadopago";
import { urlDaLoja } from "@/lib/dominios";
import { dentroDoLimite, ipDe } from "@/lib/limite";
import { soDigitos } from "@/lib/texto";
import { agendarSincronizacao } from "@/lib/canais/agendar";

const texto = (max: number) => z.string().trim().min(1).max(max);

const Corpo = z.object({
  cliente: z.object({
    nome: z.string().trim().min(2, "Informe seu nome.").max(120),
    email: z.string().trim().email("E-mail inválido.").max(200),
    telefone: z.string().trim().refine((t) => soDigitos(t).length >= 10 && soDigitos(t).length <= 13, "Telefone inválido."),
    documento: z.string().trim().max(20).optional(),
  }),
  entrega: z.discriminatedUnion("metodo", [
    z.object({ metodo: z.literal("retirada") }),
    z.object({
      metodo: z.literal("entrega"),
      endereco: z.object({
        cep: z.string().trim().regex(/^\d{5}-?\d{3}$/, "CEP inválido."),
        logradouro: texto(200),
        numero: texto(20),
        complemento: z.string().trim().max(100).optional(),
        bairro: texto(100),
        cidade: texto(100),
        uf: z.enum(UFS as [string, ...string[]]),
      }),
    }),
  ]),
  itens: z.array(z.object({ varianteId: z.number().int().positive(), quantidade: z.number().int().min(1).max(99) })).min(1).max(50),
  cupom: z.string().trim().max(40).optional(),
  pagamento: z.enum(["pix", "mercadopago", "whatsapp"]),
  observacoes: z.string().trim().max(500).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const loja = await buscarLoja((await params).slug);
  if (!loja) return Response.json({ erro: "Loja não encontrada." }, { status: 404 });
  if (!dentroDoLimite(`pedido:${ipDe(req)}`, 8, 60 * 60_000)) {
    return Response.json({ erro: "Muitos pedidos seguidos. Fale com a loja pelo WhatsApp." }, { status: 429 });
  }
  const lido = Corpo.safeParse(await req.json().catch(() => null));
  if (!lido.success) {
    return Response.json({ erro: lido.error.issues[0]?.message ?? "Confira os dados do pedido." }, { status: 400 });
  }
  const d = lido.data;
  const pagamentoOk =
    (d.pagamento === "pix" && loja.pixChave) ||
    (d.pagamento === "mercadopago" && tokenMercadoPago(loja.slug)) ||
    (d.pagamento === "whatsapp" && loja.whatsapp);
  if (!pagamentoOk) return Response.json({ erro: "Forma de pagamento indisponível." }, { status: 400 });

  let pedido;
  try {
    pedido = await criarPedido({
      lojaId: loja.id,
      canal: "site",
      cliente: d.cliente,
      itens: d.itens,
      entrega:
        d.entrega.metodo === "entrega"
          ? { metodo: "entrega", descricao: "Entrega", endereco: { ...d.entrega.endereco, cep: soDigitos(d.entrega.endereco.cep) } }
          : { metodo: "retirada", descricao: "Retirada" },
      cupomCodigo: d.cupom,
      formaPagamento: d.pagamento,
      observacoes: d.observacoes,
    });
  } catch (e) {
    if (e instanceof ErroNegocio) return Response.json({ erro: e.message }, { status: 409 });
    throw e;
  }

  agendarSincronizacao();
  let pagarEm: string | null = null;
  if (d.pagamento === "mercadopago") {
    try {
      const pref = await criarPreferencia({
        loja,
        pedido,
        cliente: d.cliente,
        urlPedido: `${urlDaLoja(loja.slug)}/pedido/${pedido.codigo}`,
      });
      await db.update(pedidos).set({ mpPreferenciaId: pref.id }).where(eq(pedidos.id, pedido.id));
      pagarEm = pref.link;
    } catch (e) {
      // o pedido fica salvo; o cliente tenta pagar de novo na página do pedido
      console.error("Mercado Pago:", e);
    }
  }
  return Response.json({ codigo: pedido.codigo, numero: pedido.numero, pagarEm });
}
