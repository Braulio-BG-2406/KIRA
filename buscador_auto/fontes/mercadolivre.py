"""Mercado Livre: API oficial de busca (api.mercadolibre.com).

A busca pode exigir token. Gere um em https://developers.mercadolivre.com.br
e defina a variável de ambiente ML_ACCESS_TOKEN (ou [mercadolivre] token).
"""

from __future__ import annotations

import datetime as dt
import os

from ..modelos import Anuncio
from ..texto import ler_ano, ler_km, ler_uf
from .base import Busca, Fonte

URL = "https://api.mercadolibre.com/sites/MLB/search"
# MLB1744 = Carros e Caminhonetes; MLB1743 = Carros, Motos e Outros (inclui caminhões).
CATEGORIA = {"carro": "MLB1744", "caminhao": "MLB1743", "cavalo": "MLB1743"}
TERMO_PADRAO = {"caminhao": "caminhão", "cavalo": "cavalo mecânico"}


def _atributos(item: dict) -> dict:
    return {a.get("id"): a.get("value_name") for a in item.get("attributes") or []}


def ler_resultados(dado: dict, categoria: str = "", ano_atual: int | None = None) -> list[Anuncio]:
    ano_atual = ano_atual or dt.date.today().year
    anuncios = []
    for item in dado.get("results") or []:
        attrs = _atributos(item)
        local = item.get("location") or item.get("seller_address") or {}
        estado = local.get("state") or {}
        uf = ler_uf(estado.get("id") or "") or ler_uf(estado.get("name") or "")
        anuncios.append(Anuncio(
            fonte="mercadolivre",
            id=str(item.get("id")),
            titulo=item.get("title") or "",
            preco=float(item.get("price") or 0),
            url=item.get("permalink") or "",
            marca=attrs.get("BRAND") or "",
            modelo=attrs.get("MODEL") or "",
            versao=attrs.get("TRIM") or attrs.get("VERSION") or "",
            ano=ler_ano(attrs.get("VEHICLE_YEAR") or item.get("title"), ano_atual),
            km=ler_km(attrs.get("KILOMETERS")),
            cidade=(local.get("city") or {}).get("name") or "",
            uf=uf,
            categoria=categoria,
            combustivel=attrs.get("FUEL_TYPE") or "",
            imagem=item.get("thumbnail") or "",
        ))
    return anuncios


class MercadoLivre(Fonte):
    nome = "mercadolivre"
    por_pagina = 50

    def __init__(self, *args, token: str | None = None, categorias: dict | None = None, **kwargs):
        super().__init__(*args, **kwargs)
        token = token or os.environ.get("ML_ACCESS_TOKEN")
        if token:
            self.sessao.headers["Authorization"] = f"Bearer {token}"
        self.categorias = {**CATEGORIA, **(categorias or {})}

    def parametros(self, busca: Busca, pagina: int) -> dict:
        params = {
            "category": self.categorias.get(busca.categoria, CATEGORIA["carro"]),
            "limit": self.por_pagina,
            "offset": (pagina - 1) * self.por_pagina,
        }
        termo = busca.consulta or TERMO_PADRAO.get(busca.categoria, "")
        if termo:
            params["q"] = termo
        if busca.preco_min or busca.preco_max:
            params["price"] = f"{int(busca.preco_min or 0)}-{int(busca.preco_max) if busca.preco_max else '*'}"
        return params

    def buscar(self, busca: Busca) -> list[Anuncio]:
        anuncios = []
        for pagina in range(1, busca.paginas + 1):
            dado = self._get(URL, params=self.parametros(busca, pagina)).json()
            novos = ler_resultados(dado, busca.categoria)
            anuncios += novos
            total = (dado.get("paging") or {}).get("total") or 0
            if not novos or pagina * self.por_pagina >= total:
                break
        return anuncios
