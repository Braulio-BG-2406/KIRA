"""Webmotors: usa a API interna que alimenta a página de estoque (só carros)."""

from __future__ import annotations

import datetime as dt
import logging
import re

from ..modelos import Anuncio
from ..texto import ler_ano, ler_uf, normalizar
from .base import Busca, Fonte

log = logging.getLogger(__name__)

URL_API = "https://www.webmotors.com.br/api/search/car"
URL_SITE = "https://www.webmotors.com.br"


def _slug(texto) -> str:
    return re.sub(r"[^a-z0-9]+", "-", normalizar(texto)).strip("-")


def _valor(no):
    return no.get("Value") if isinstance(no, dict) else no


def ler_resultados(dado: dict, ano_atual: int | None = None) -> list[Anuncio]:
    ano_atual = ano_atual or dt.date.today().year
    anuncios = []
    for r in dado.get("SearchResults") or []:
        esp = r.get("Specification") or {}
        vend = r.get("Seller") or {}
        precos = r.get("Prices") or {}
        marca, modelo, versao = (_valor(esp.get(k)) or "" for k in ("Make", "Model", "Version"))
        ano_fab, ano_mod = esp.get("YearFabrication"), esp.get("YearModel")
        uid = r.get("UniqueId")
        url = ""
        if uid and marca and modelo:
            url = (f"{URL_SITE}/comprar/{_slug(marca)}/{_slug(modelo)}/{_slug(versao) or 'versao'}/"
                   f"{esp.get('NumberPorts') or 4}-portas/{int(float(ano_fab or ano_mod or 0))}-"
                   f"{int(float(ano_mod or ano_fab or 0))}/{uid}")
        anuncios.append(Anuncio(
            fonte="webmotors",
            id=str(uid),
            titulo=esp.get("Title") or f"{marca} {modelo} {versao}".strip(),
            preco=float(precos.get("Price") or precos.get("SearchPrice") or 0),
            url=url,
            marca=marca,
            modelo=modelo,
            versao=versao,
            ano=ler_ano(ano_mod or ano_fab, ano_atual),
            km=int(float(esp["Odometer"])) if esp.get("Odometer") is not None else None,
            cidade=vend.get("City") or "",
            uf=ler_uf(vend.get("State") or ""),
            descricao=r.get("LongComment") or "",
            categoria="carro",
            vendedor="loja" if vend.get("SellerType") == "PJ" else "particular",
            combustivel=esp.get("Fuel") or "",
        ))
    return anuncios


class Webmotors(Fonte):
    nome = "webmotors"
    por_pagina = 24

    def url_estoque(self, busca: Busca) -> str:
        caminho = "/carros/estoque"
        if busca.marca:
            caminho += f"/{_slug(busca.marca)}"
            if busca.modelo:
                caminho += f"/{_slug(busca.modelo)}"
        filtros = ["tipoveiculo=carros"]
        if busca.marca:
            filtros.append(f"marca1={busca.marca.upper()}")
        if busca.modelo:
            filtros.append(f"modelo1={busca.modelo.upper()}")
        if busca.termo:
            filtros.append(f"palavrachave={busca.termo}")
        if busca.ano_min:
            filtros.append(f"anode={busca.ano_min}")
        if busca.ano_max:
            filtros.append(f"anoate={busca.ano_max}")
        if busca.preco_min:
            filtros.append(f"precode={int(busca.preco_min)}")
        if busca.preco_max:
            filtros.append(f"precoate={int(busca.preco_max)}")
        if busca.km_max:
            filtros.append(f"kmate={busca.km_max}")
        if len(busca.ufs) == 1:
            filtros.append(f"estadocidade={busca.ufs[0]}")
        return f"{URL_SITE}{caminho}?{'&'.join(filtros)}"

    def buscar(self, busca: Busca) -> list[Anuncio]:
        if busca.categoria != "carro":
            log.info("Webmotors: só carros; busca %r ignorada nesta fonte", busca.nome)
            return []
        anuncios = []
        for pagina in range(1, busca.paginas + 1):
            params = {
                "url": self.url_estoque(busca),
                "actualPage": pagina,
                "displayPerPage": self.por_pagina,
                "order": 1,
                "showMenu": "false",
                "showCount": "true",
                "showBreadCrumb": "false",
                "testAB": "false",
                "returnUrl": "false",
            }
            novos = ler_resultados(self._get(URL_API, params=params).json())
            if not novos:
                break
            anuncios += novos
        return anuncios
