"""Função da Vercel: /api/buscar (lógica em buscador_auto/web.py)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from buscador_auto.web import Handler  # noqa: E402


class handler(Handler):  # a Vercel procura uma classe chamada "handler"
    pass
