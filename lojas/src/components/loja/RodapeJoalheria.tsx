import Link from "next/link";
import type { Categoria } from "./tipos";

type Props = {
  nome: string;
  slogan: string | null;
  logo: string | null;
  base: string;
  categorias: Categoria[];
  institucional: { nome: string; href: string }[];
  ajuda: { nome: string; href: string }[];
  whatsapp: string | null;
  instagram: string | null;
  email: string | null;
  empresa?: { razao: string; cnpj: string; endereco: string };
};

/** rodapé escuro: logo, coleções, atendimento, páginas institucionais, pagamento e dados da empresa */
export function RodapeJoalheria({ nome, slogan, logo, base, categorias, institucional, ajuda, whatsapp, instagram, email, empresa }: Props) {
  const titulo = "sobrelinha-j mb-4";
  const link = "block py-1 text-[14px] text-[#c2bdb4] transition hover:text-[#f3efe6]";
  return (
    <footer id="rodape" className="mt-24 border-t border-[#f3efe6]/8 bg-[#0b0b0c] text-[#f3efe6]">
      <div className="mx-auto max-w-[1440px] px-5 pb-10 pt-16 sm:px-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={nome} className="h-16 w-auto" />
            ) : (
              <p className="font-titulo text-3xl">{nome}</p>
            )}
            {slogan && <p className="mt-5 max-w-xs text-[14px] leading-relaxed text-[#c2bdb4]">{slogan}</p>}
          </div>
          <div>
            <p className={titulo}>Loja</p>
            <Link href={`${base}/catalogo`} className={link}>
              Catálogo
            </Link>
            {categorias.slice(0, 5).map((c) => (
              <Link key={c.id} href={`${base}/categoria/${c.slug}`} className={link}>
                {c.nome}
              </Link>
            ))}
            <Link href={`${base}/pedido`} className={link}>
              Acompanhar pedido
            </Link>
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
              <a href={`mailto:${email}`} className={`${link} break-all`}>
                {email}
              </a>
            )}
          </div>
          {institucional.length > 0 && (
            <div>
              <p className={titulo}>Institucional</p>
              {institucional.map((p) => (
                <Link key={p.href} href={`${base}${p.href}`} className={link}>
                  {p.nome}
                </Link>
              ))}
            </div>
          )}
          {ajuda.length > 0 && (
            <div>
              <p className={titulo}>Ajuda</p>
              {ajuda.map((p) => (
                <Link key={p.href} href={`${base}${p.href}`} className={link}>
                  {p.nome}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="mt-12 grid gap-6 border-t border-[#30302d] pt-8 sm:grid-cols-2">
          <div>
            <p className={titulo}>Pagamento</p>
            <p className="text-[14px] text-[#c2bdb4]">Pix · Cartão de crédito · Boleto</p>
            <p className="mt-1 text-[13px] text-[#8a857c]">Cartão e boleto processados pelo Mercado Pago. Os dados do cartão não ficam na loja.</p>
          </div>
          <div className="sm:text-right">
            <p className={titulo}>Loja segura</p>
            <p className="text-[14px] text-[#c2bdb4]">Conexão criptografada (HTTPS)</p>
            <p className="mt-1 text-[13px] text-[#8a857c]">Troca em até 7 dias · Garantia de 90 dias</p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#30302d] pt-6 text-[12px] text-[#8a857c]">
          <p>
            {empresa ? `${empresa.razao} · CNPJ ${empresa.cnpj} · ${empresa.endereco}` : nome} · © {new Date().getFullYear()}
          </p>
          <a href="#" className="flex items-center gap-2 text-[#c2bdb4] hover:text-[#f3efe6]">
            Voltar ao topo <span aria-hidden>↑</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
