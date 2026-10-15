import Link from "next/link";
import type { Categoria } from "./tipos";

/** rodapé de relojoaria: nome espaçado, coleções, atendimento e formas de pagamento */
export function RodapeRelojoaria({
  nome,
  sobre,
  base,
  categorias,
  whatsapp,
  instagram,
  email,
  parcelas,
}: {
  nome: string;
  sobre: string | null;
  base: string;
  categorias: Categoria[];
  whatsapp: string | null;
  instagram: string | null;
  email: string | null;
  parcelas: number;
}) {
  const titulo = "sobrelinha mb-5 text-white/45";
  const link = "block py-1 text-[15px] font-light text-white/75 transition hover:text-white";
  return (
    <footer className="bg-[#141414] text-white">
      <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-20 sm:px-10">
        <div className="border-b border-white/10 pb-12 text-center">
          <p className="pl-[0.45em] text-lg uppercase tracking-[0.45em]">{nome}</p>
          {sobre && <p className="mx-auto mt-4 max-w-xl text-[15px] font-light leading-relaxed text-white/55">{sobre}</p>}
        </div>
        <div className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className={titulo}>Coleções</p>
            {categorias.slice(0, 8).map((c) => (
              <Link key={c.id} href={`${base}/categoria/${c.slug}`} className={link}>
                {c.nome}
              </Link>
            ))}
          </div>
          <div>
            <p className={titulo}>Atendimento</p>
            {whatsapp && (
              <a href={whatsapp} target="_blank" rel="noopener" className={link}>
                WhatsApp
              </a>
            )}
            {instagram && (
              <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noopener" className={link}>
                Instagram
              </a>
            )}
            {email && (
              <a href={`mailto:${email}`} className={link}>
                {email}
              </a>
            )}
          </div>
          <div>
            <p className={titulo}>Sua compra</p>
            <Link href={`${base}/pedido`} className={link}>
              Acompanhar pedido
            </Link>
            <Link href={`${base}/carrinho`} className={link}>
              Sacola
            </Link>
            <p className="py-1 text-[15px] font-light text-white/75">Devolução em até 7 dias</p>
          </div>
          <div>
            <p className={titulo}>Pagamento</p>
            <p className="py-1 text-[15px] font-light text-white/75">Pix</p>
            <p className="py-1 text-[15px] font-light text-white/75">Cartão de crédito{parcelas > 1 ? ` em até ${parcelas}x` : ""}</p>
            <p className="py-1 text-[15px] font-light text-white/75">Boleto</p>
          </div>
        </div>
        <p className="border-t border-white/10 pt-8 text-center text-xs tracking-[0.1em] text-white/40">
          © {new Date().getFullYear()} {nome} · Compra segura
        </p>
      </div>
    </footer>
  );
}
