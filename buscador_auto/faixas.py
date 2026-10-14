"""As três faixas de análise: pesados, populares (marcas nacionais) e premium.

Cada faixa vira poucas buscas (uma por termo, modelo ou marca) e cada anúncio
é avaliado com os custos e metas da sua faixa.
"""

from __future__ import annotations

import re

from .categorias import CAMINHAO, CARRO, CAVALO
from .fontes.base import Busca
from .modelos import Anuncio
from .texto import menciona, normalizar

PESADOS, POPULARES, PREMIUM, OUTROS = "pesados", "populares", "premium", "outros"
FAIXAS = (PESADOS, POPULARES, PREMIUM)
NOMES_FAIXA = {PESADOS: "Pesados", POPULARES: "Populares", PREMIUM: "Premium", OUTROS: "Outros"}

TERMOS_PESADOS = ["cavalo mecânico", "caminhão truck", "caminhão toco"]
MARCAS_NACIONAIS = ["Volkswagen", "Chevrolet", "Fiat", "Ford", "Renault", "Hyundai",
                    "Toyota", "Honda", "Nissan", "Peugeot", "Citroën"]
MODELOS_POPULARES = ["Chevrolet Onix", "Hyundai HB20", "Volkswagen Gol", "Volkswagen Polo", "Fiat Argo",
                     "Fiat Mobi", "Fiat Strada", "Renault Kwid", "Renault Sandero", "Ford Ka"]
MARCAS_PREMIUM = ["BMW", "Audi", "Mercedes-Benz"]
TETO_POPULARES = 110000  # carro nacional acima disso não é "popular" (vale para planilhas)

# Para reconhecer populares em planilhas sem a coluna marca.
_NOMES_POPULARES = (
    r"\b(onix|prisma|celta|corsa|cobalt|hb20s?|gol|polo|virtus|voyage|fox|up|saveiro|argo|cronos|mobi|"
    r"uno|palio|siena|strada|kwid|sandero|logan|ka|fiesta|208|c3|march|versa|etios|yaris|fit|city)\b"
)
# Utilitários de marca premium que não são carro premium.
_UTILITARIOS_PREMIUM = r"\b(sprinter|vito)\b"


def _cfg(config: dict | None, faixa: str) -> dict:
    return ((config or {}).get("faixas") or {}).get(faixa) or {}


def faixa_do_anuncio(anuncio: Anuncio, categoria: str, config: dict | None = None) -> str:
    if categoria in (CAMINHAO, CAVALO):
        return PESADOS
    texto = anuncio.marca or anuncio.titulo
    if any(menciona(texto, m) for m in _cfg(config, PREMIUM).get("marcas", MARCAS_PREMIUM)):
        return OUTROS if re.search(_UTILITARIOS_PREMIUM, normalizar(anuncio.titulo)) else PREMIUM
    pop = _cfg(config, POPULARES)
    teto = pop.get("teto") or pop.get("preco_max") or TETO_POPULARES
    nacional = any(menciona(texto, m) for m in pop.get("marcas", MARCAS_NACIONAIS)) or (
        not anuncio.marca and re.search(_NOMES_POPULARES, normalizar(anuncio.titulo))
    )
    return POPULARES if nacional and anuncio.preco <= teto else OUTROS


def perfil_custos(categoria: str, faixa: str) -> str:
    """Qual tabela de custos usar: caminhao, cavalo, premium ou populares."""
    if categoria in (CAMINHAO, CAVALO):
        return categoria
    return PREMIUM if faixa == PREMIUM else POPULARES


_FILTROS = ("preco_min", "preco_max", "ano_min", "ano_max", "km_max", "ufs", "fontes", "paginas")


def _filtros(cfg: dict) -> dict:
    return {k: cfg[k] for k in _FILTROS if k in cfg}


def _separar_marca_modelo(item: str) -> tuple[str, str]:
    """"Chevrolet Onix" -> ("Chevrolet", "Onix"); "Mercedes-Benz Classe C" -> ("Mercedes-Benz", "Classe C")."""
    partes = item.split(maxsplit=1)
    return (partes[0], partes[1]) if len(partes) == 2 else ("", item)


def buscas_das_faixas(config: dict) -> list[Busca]:
    """Monta as buscas a partir de [faixas.pesados], [faixas.populares] e [faixas.premium].

    Faixa ausente do arquivo ou com `ativa = false` não gera busca.
    """
    faixas = config.get("faixas") or {}
    buscas = []

    p = faixas.get(PESADOS)
    if p and p.get("ativa", True):
        for termo in p.get("termos", TERMOS_PESADOS):
            categoria = CAVALO if "cavalo" in normalizar(termo) else CAMINHAO
            buscas.append(Busca(nome=f"Pesados · {termo}", faixa=PESADOS, categoria=categoria, termo=termo,
                                **{"fontes": ["olx", "mercadolivre"], **_filtros(p)}))

    p = faixas.get(POPULARES)
    if p and p.get("ativa", True):
        for item in p.get("modelos", MODELOS_POPULARES):
            marca, modelo = _separar_marca_modelo(item)
            buscas.append(Busca(nome=f"Populares · {item}", faixa=POPULARES, categoria=CARRO,
                                marca=marca, modelo=modelo, **_filtros(p)))

    p = faixas.get(PREMIUM)
    if p and p.get("ativa", True):
        for marca in p.get("marcas", MARCAS_PREMIUM):
            modelos = (p.get("modelos") or {}).get(marca) or [""]
            for modelo in modelos:
                nome = f"Premium · {marca} {modelo}".strip()
                buscas.append(Busca(nome=nome, faixa=PREMIUM, categoria=CARRO, marca=marca, modelo=modelo,
                                    **_filtros(p)))
    return buscas
