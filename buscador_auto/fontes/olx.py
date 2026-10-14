"""OLX: lê os anúncios do JSON __NEXT_DATA__ embutido na página de resultados."""

from __future__ import annotations

import datetime as dt
import json
import logging
import re

from ..modelos import Anuncio
from ..texto import ler_ano, ler_km, ler_numero, ler_uf, normalizar
from .base import Busca, Fonte

log = logging.getLogger(__name__)

URL = "https://www.olx.com.br/autos-e-pecas"
SECAO = {"carro": "carros-vans-e-utilitarios", "caminhao": "caminhoes", "cavalo": "caminhoes"}

_RE_NEXT = re.compile(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.S)


def _achar_lista_anuncios(no):
    """Procura no JSON a primeira lista de dicionários com "subject" e "price"."""
    if isinstance(no, list):
        if no and all(isinstance(x, dict) for x in no) and any("subject" in x and "price" in x for x in no):
            return no
        for x in no:
            achado = _achar_lista_anuncios(x)
            if achado:
                return achado
    elif isinstance(no, dict):
        if isinstance(no.get("ads"), list):
            achado = _achar_lista_anuncios(no["ads"])
            if achado:
                return achado
        for v in no.values():
            achado = _achar_lista_anuncios(v)
            if achado:
                return achado
    return None


def _propriedades(ad: dict) -> dict:
    props = {}
    for p in ad.get("properties") or []:
        valor = p.get("value")
        if p.get("name"):
            props[p["name"]] = valor
        if p.get("label"):
            props[normalizar(p["label"])] = valor
    return props


def _primeiro(props: dict, *chaves):
    for c in chaves:
        if props.get(c) not in (None, ""):
            return props[c]
    return ""


def ler_pagina(html: str, categoria: str = "", ano_atual: int | None = None) -> list[Anuncio]:
    ano_atual = ano_atual or dt.date.today().year
    m = _RE_NEXT.search(html)
    if not m:
        log.warning("OLX: página sem __NEXT_DATA__ (bloqueio ou mudança de layout)")
        return []
    ads = _achar_lista_anuncios(json.loads(m.group(1))) or []
    anuncios = []
    for ad in ads:
        if not ad.get("subject") or not (ad.get("listId") or ad.get("url")):
            continue  # banners e publicidade
        props = _propriedades(ad)
        loc = ad.get("locationDetails") or {}
        local = ad.get("location") or ""
        cidade = loc.get("municipality") or (local.split(",")[0].split(" - ")[0] if local else "")
        uf = loc.get("uf") or ler_uf(local)
        titulo = ad["subject"]
        anuncios.append(Anuncio(
            fonte="olx",
            id=str(ad.get("listId") or ad.get("url")),
            titulo=titulo,
            preco=ler_numero(ad.get("price")) or 0.0,
            url=ad.get("url") or ad.get("friendlyUrl") or "",
            marca=str(_primeiro(props, "vehicle_brand", "truck_brand", "marca")),
            modelo=str(_primeiro(props, "vehicle_model", "truck_model", "modelo")),
            versao=str(_primeiro(props, "vehicle_version", "versao")),
            ano=ler_ano(_primeiro(props, "regdate", "ano", "ano modelo") or titulo, ano_atual),
            km=ler_km(_primeiro(props, "mileage", "quilometragem", "km") or None),
            cidade=cidade,
            uf=uf,
            descricao=ad.get("body") or ad.get("description") or "",
            categoria=categoria,
            vendedor="loja" if ad.get("professionalAd") else "particular",
            combustivel=str(_primeiro(props, "fuel", "combustivel")),
            imagem=ad.get("thumbnail") or "",
        ))
    return anuncios


class OLX(Fonte):
    nome = "olx"

    def urls(self, busca: Busca, pagina: int) -> list[tuple[str, dict]]:
        secao = SECAO.get(busca.categoria, SECAO["carro"])
        params = {"o": pagina} if pagina > 1 else {}
        termo = busca.consulta or ("cavalo mecanico" if busca.categoria == "cavalo" else "")
        if termo:
            params["q"] = termo
        if busca.preco_min:
            params["ps"] = int(busca.preco_min)
        if busca.preco_max:
            params["pe"] = int(busca.preco_max)
        bases = [f"{URL}/{secao}/estado-{uf.lower()}" for uf in busca.ufs] or [f"{URL}/{secao}"]
        return [(b, params) for b in bases]

    def buscar(self, busca: Busca) -> list[Anuncio]:
        anuncios = []
        for pagina in range(1, busca.paginas + 1):
            novos = []
            for url, params in self.urls(busca, pagina):
                html = self._get(url, params=params).text
                novos += ler_pagina(html, busca.categoria)
            if not novos:
                break
            anuncios += novos
        return anuncios
