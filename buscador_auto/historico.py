"""Histórico em SQLite: marca anúncios novos, quedas de preço e o que já foi notificado."""

from __future__ import annotations

import sqlite3
import time
from pathlib import Path

from .modelos import Avaliacao


class Historico:
    def __init__(self, caminho: str | Path = "dados/buscador_auto.db"):
        if str(caminho) != ":memory:":
            Path(caminho).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(str(caminho))
        self.db.execute(
            """CREATE TABLE IF NOT EXISTS anuncios (
                chave TEXT PRIMARY KEY,
                fonte TEXT, titulo TEXT, url TEXT,
                primeiro_visto REAL, ultimo_visto REAL,
                preco_inicial REAL, preco_atual REAL,
                notificado_preco REAL
            )"""
        )
        self.db.commit()

    def registrar(self, avaliacoes: list[Avaliacao], agora: float | None = None) -> None:
        """Atualiza o histórico e preenche `novo` e `queda_preco` em cada avaliação."""
        agora = agora or time.time()
        for av in avaliacoes:
            a = av.anuncio
            linha = self.db.execute(
                "SELECT preco_inicial FROM anuncios WHERE chave = ?", (a.chave,)
            ).fetchone()
            if linha is None:
                av.novo, av.queda_preco = True, 0.0
                self.db.execute(
                    "INSERT INTO anuncios VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)",
                    (a.chave, a.fonte, a.titulo, a.url, agora, agora, a.preco, a.preco),
                )
            else:
                av.novo = False
                av.queda_preco = max(0.0, linha[0] - a.preco)
                self.db.execute(
                    "UPDATE anuncios SET ultimo_visto = ?, preco_atual = ?, titulo = ?, url = ? WHERE chave = ?",
                    (agora, a.preco, a.titulo, a.url, a.chave),
                )
        self.db.commit()

    def para_notificar(self, avaliacoes: list[Avaliacao], score_minimo: int) -> list[Avaliacao]:
        """Oportunidades boas que ainda não foram avisadas (ou que baixaram de preço)."""
        escolhidas = []
        for av in avaliacoes:
            if av.score < score_minimo or av.risco_alto:
                continue
            linha = self.db.execute(
                "SELECT notificado_preco FROM anuncios WHERE chave = ?", (av.anuncio.chave,)
            ).fetchone()
            ja_avisado = linha[0] if linha else None
            if ja_avisado is None or av.anuncio.preco < ja_avisado:
                escolhidas.append(av)
        return escolhidas

    def marcar_notificado(self, av: Avaliacao) -> None:
        self.db.execute(
            "UPDATE anuncios SET notificado_preco = ? WHERE chave = ?", (av.anuncio.preco, av.anuncio.chave)
        )
        self.db.commit()
