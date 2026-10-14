"""Normalização de texto e leitura de preço, quilometragem e ano em anúncios."""

from __future__ import annotations

import re
import unicodedata

# Tokens de modelo: tração (6x2), válvulas (16v), portas (4p), norma Euro (e5),
# números com decimal (1.0, 25.420) e palavras.
_RE_TOKEN = re.compile(r"\d+x\d+|\d{1,2}v\b|\dp\b|\be\d\b|\d+(?:\.\d+)?|[a-z]+")


def normalizar(texto) -> str:
    """Minúsculas, sem acentos e com espaços simples."""
    if texto is None:
        return ""
    t = unicodedata.normalize("NFKD", str(texto))
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", t.lower()).strip()


def tokens(texto) -> list[str]:
    """Quebra um nome de modelo em tokens comparáveis.

    "R-450 A 6x2" e "R450 A 6 x 2" geram os mesmos tokens: r, 450, a, 6x2.
    """
    t = normalizar(texto)
    t = re.sub(r"(\d),(\d)", r"\1.\2", t)
    t = re.sub(r"(\d)\s*x\s*(\d)", r"\1x\2", t)
    return _RE_TOKEN.findall(t)


def ler_numero(texto) -> float | None:
    """Converte "R$ 45.900,00", "45900", "1.234.567" ou "45,9 mil" em float."""
    if texto is None:
        return None
    if isinstance(texto, (int, float)):
        return float(texto)
    t = normalizar(texto).replace("r$", "").replace("km", "").strip()
    mult = 1
    if re.search(r"\bmil\b", t):
        mult = 1000
        t = re.sub(r"\bmil\b", "", t)
    t = re.sub(r"[^\d.,]", "", t)
    if not t:
        return None
    if "," in t:
        t = t.replace(".", "").replace(",", ".")
    elif re.fullmatch(r"\d{1,3}(\.\d{3})+", t):
        t = t.replace(".", "")
    try:
        return float(t) * mult
    except ValueError:
        return None


def ler_km(texto) -> int | None:
    n = ler_numero(texto)
    return int(n) if n is not None else None


def ler_ano(texto, ano_atual: int) -> int | None:
    """Ano-modelo a partir de "2015/2016", "15/16", "2016" ou de um título.

    Números de modelo de caminhão (Axor 2041, Cargo 2042) ficam fora porque
    só valem anos entre 1970 e o ano que vem; se houver vários, vale o último.
    """
    if texto is None:
        return None
    if isinstance(texto, (int, float)):
        return int(texto)
    t = normalizar(texto)
    m = re.search(r"\b((?:19|20)\d{2})\s*/\s*((?:19|20)\d{2})\b", t)
    if m:
        return int(m.group(2))
    m = re.search(r"\b(\d{2})\s*/\s*(\d{2})\b", t)
    if m and int(m.group(2)) - int(m.group(1)) in (0, 1):
        return 2000 + int(m.group(2))
    anos = [int(a) for a in re.findall(r"\b((?:19|20)\d{2})\b", t)]
    anos = [a for a in anos if 1970 <= a <= ano_atual + 1]
    return anos[-1] if anos else None


def contem(texto_normalizado: str, padrao: str) -> bool:
    return re.search(padrao, texto_normalizado) is not None


def formatar_reais(valor) -> str:
    if valor is None:
        return "-"
    s = f"{abs(valor):,.0f}".replace(",", ".")
    return f"-R$ {s}" if valor < 0 else f"R$ {s}"


def formatar_pct(valor) -> str:
    if valor is None:
        return "-"
    return f"{valor * 100:+.1f}%".replace(".", ",")


UFS = {
    "acre": "AC", "alagoas": "AL", "amapa": "AP", "amazonas": "AM", "bahia": "BA",
    "ceara": "CE", "distrito federal": "DF", "espirito santo": "ES", "goias": "GO",
    "maranhao": "MA", "mato grosso": "MT", "mato grosso do sul": "MS",
    "minas gerais": "MG", "para": "PA", "paraiba": "PB", "parana": "PR",
    "pernambuco": "PE", "piaui": "PI", "rio de janeiro": "RJ",
    "rio grande do norte": "RN", "rio grande do sul": "RS", "rondonia": "RO",
    "roraima": "RR", "santa catarina": "SC", "sao paulo": "SP", "sergipe": "SE",
    "tocantins": "TO",
}


def ler_uf(texto) -> str:
    """"SP", "BR-SP", "São Paulo", "São Paulo (SP)" ou "Campinas - SP" -> "SP"."""
    t = normalizar(texto)
    if not t:
        return ""
    m = re.search(r"(?:^|[\s(\-,/])([a-z]{2})\)?$", t)
    if m and m.group(1).upper() in UFS.values():
        return m.group(1).upper()
    return UFS.get(t, "")
