export function semAcentos(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function criarSlug(s: string): string {
  return (
    semAcentos(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "item"
  );
}

export function soDigitos(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

const COR = /^#[0-9a-fA-F]{6}$/;
export function corValida(c: string | null | undefined, padrao: string): string {
  return c && COR.test(c) ? c : padrao;
}

/** link wa.me a partir de um telefone brasileiro */
export function linkWhatsapp(telefone: string, mensagem?: string): string {
  let n = soDigitos(telefone);
  if (n.length <= 11) n = "55" + n;
  return `https://wa.me/${n}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ""}`;
}
