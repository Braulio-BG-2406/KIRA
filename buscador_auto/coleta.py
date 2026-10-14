"""Coleta de anúncios de uma busca nas fontes configuradas (usada pelo terminal e pelo site)."""

from __future__ import annotations

import logging

import requests

from .categorias import detectar_categoria
from .faixas import faixa_do_anuncio
from .fontes import FONTES, Busca, MercadoLivre, criar_sessao
from .modelos import Anuncio

log = logging.getLogger(__name__)


def montar_fontes(config: dict, fontes=None) -> dict:
    fontes = fontes or FONTES
    sessao = criar_sessao()
    pausa = float(config["geral"]["pausa_entre_requisicoes"])
    instancias = {}
    for nome, classe in fontes.items():
        if classe is MercadoLivre:
            ml = config.get("mercadolivre", {})
            instancias[nome] = classe(sessao, pausa=pausa, token=ml.get("token") or None,
                                      categorias=ml.get("categorias"))
        else:
            instancias[nome] = classe(sessao, pausa=pausa)
    return instancias


def explicar_erro(erro: Exception) -> str:
    """Mensagem curta para mostrar ao usuário quando uma fonte falha."""
    if isinstance(erro, PermissionError):
        return str(erro)
    if isinstance(erro, requests.Timeout):
        return "o site demorou demais para responder"
    if isinstance(erro, requests.HTTPError) and erro.response is not None:
        return f"o site respondeu com erro {erro.response.status_code}"
    if isinstance(erro, requests.ConnectionError):
        return "não foi possível conectar ao site"
    if isinstance(erro, ValueError):
        return "resposta do site em formato inesperado (o site pode ter mudado)"
    return str(erro)[:150]


def da_faixa(a: Anuncio, busca: Busca, config: dict) -> bool:
    """Um caminhão Mercedes achado na busca premium não entra como premium (e vice-versa)."""
    if not busca.faixa:
        return True
    categoria = detectar_categoria(a.texto_completo, a.categoria or busca.categoria)
    return faixa_do_anuncio(a, categoria, config) == busca.faixa


def coletar(busca: Busca, fontes: dict, config: dict) -> tuple[list[Anuncio], list[dict]]:
    """Roda uma busca em todas as suas fontes. Devolve os anúncios aceitos e o
    resumo por fonte; uma fonte fora do ar não derruba as outras."""
    aceitos: list[Anuncio] = []
    resumo = []
    for nome in busca.fontes:
        fonte = fontes.get(nome)
        if not fonte:
            resumo.append({"fonte": nome, "erro": "fonte desconhecida"})
            continue
        try:
            achados = fonte.buscar(busca)
        except Exception as erro:
            log.warning("[%s] %s: %s", busca.nome, nome, erro)
            resumo.append({"fonte": nome, "erro": explicar_erro(erro)})
            continue
        bons = [a for a in achados if busca.aceita(a) and da_faixa(a, busca, config)]
        for a in bons:
            a.busca = busca.nome
            a.categoria = a.categoria or busca.categoria
        aceitos += bons
        resumo.append({"fonte": nome, "achados": len(achados), "aceitos": len(bons)})
    return aceitos, resumo
