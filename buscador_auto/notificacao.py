"""Envio das melhores oportunidades para o Telegram."""

from __future__ import annotations

import html
import logging

import requests

from .categorias import NOMES
from .modelos import Avaliacao
from .texto import formatar_pct, formatar_reais

log = logging.getLogger(__name__)


def mensagem(av: Avaliacao) -> str:
    a = av.anuncio
    e = html.escape
    linhas = [
        f"<b>{e(a.titulo)}</b>",
        f"{NOMES.get(av.categoria, av.categoria)} · {a.ano or '?'} · "
        f"{f'{a.km:,} km'.replace(',', '.') if a.km is not None else 'km ?'} · {e(a.cidade)} {e(a.uf)}".strip(),
        f"💰 Preço: <b>{formatar_reais(a.preco)}</b>"
        + (f" (baixou {formatar_reais(av.queda_preco)})" if av.queda_preco else ""),
    ]
    if av.fipe_ajustada:
        linhas.append(f"📊 FIPE ajustada: {formatar_reais(av.fipe_ajustada)} ({formatar_pct(av.desconto_fipe_pct)} abaixo)")
    if av.mediana_mercado:
        linhas.append(f"📈 Mercado: {formatar_reais(av.mediana_mercado)} ({av.comparaveis} anúncios)")
    if av.lucro is not None:
        linhas.append(f"🔁 Revenda: lucro {formatar_reais(av.lucro)} · margem {formatar_pct(av.margem_pct)} → {av.veredito_revenda}")
    linhas.append(f"🚗 Uso próprio: {av.veredito_uso} · Nota {av.score}/100")
    for alerta in av.alertas:
        if alerta.gravidade != "info":
            linhas.append(f"⚠️ {e(alerta.mensagem)}")
    if av.sinais:
        linhas.append("✅ " + e(", ".join(av.sinais)))
    if a.url:
        linhas.append(f'<a href="{e(a.url, quote=True)}">Abrir anúncio ({e(a.fonte)})</a>')
    return "\n".join(linhas)


def enviar_telegram(token: str, chat_id: str, texto: str, sessao: requests.Session | None = None) -> bool:
    resp = (sessao or requests).post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        json={"chat_id": chat_id, "text": texto, "parse_mode": "HTML", "disable_web_page_preview": True},
        timeout=30,
    )
    if not resp.ok:
        log.error("Telegram recusou a mensagem: %s %s", resp.status_code, resp.text[:200])
    return resp.ok
