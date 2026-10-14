import { notFound } from "next/navigation";
import { baseDaLoja, buscarLoja } from "@/lib/lojas";
import { tokenMercadoPago } from "@/lib/mercadopago";
import { Checkout, type OpcaoPagamento } from "@/components/loja/Checkout";

export const metadata = { title: "Finalizar compra", robots: { index: false } };

export default async function PaginaCheckout({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loja = await buscarLoja(slug);
  if (!loja) notFound();
  const pagamentos: OpcaoPagamento[] = [];
  if (loja.pixChave) {
    pagamentos.push({
      id: "pix",
      nome: loja.descontoPixPct > 0 ? `Pix com ${loja.descontoPixPct}% de desconto` : "Pix",
      detalhe: "QR Code e copia e cola na próxima tela. Confirmamos assim que o valor cair.",
    });
  }
  if (tokenMercadoPago(slug)) {
    pagamentos.push({
      id: "mercadopago",
      nome: "Cartão, Pix ou boleto (Mercado Pago)",
      detalhe: loja.parcelasSemJuros > 1 ? `Em até ${loja.parcelasSemJuros}x sem juros no cartão. Você paga no ambiente seguro do Mercado Pago.` : "Você paga no ambiente seguro do Mercado Pago.",
    });
  }
  if (loja.whatsapp) pagamentos.push({ id: "whatsapp", nome: "Combinar pelo WhatsApp", detalhe: "A gente fala com você para acertar o pagamento." });
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-8 font-titulo text-4xl text-marca">Finalizar compra</h1>
      <Checkout slug={slug} base={await baseDaLoja(slug)} pagamentos={pagamentos} descontoPixPct={loja.pixChave ? loja.descontoPixPct : 0} />
    </div>
  );
}
