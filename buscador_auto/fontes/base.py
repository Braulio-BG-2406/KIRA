"""Definição de uma busca e utilidades comuns às fontes."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

import requests

from ..fipe import ALIAS_MARCA
from ..modelos import Anuncio
from ..texto import normalizar

log = logging.getLogger(__name__)

NAVEGADOR = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/129.0 Safari/537.36"
)


@dataclass
class Busca:
    nome: str
    categoria: str = "carro"  # carro, caminhao ou cavalo
    termo: str = ""
    marca: str = ""
    modelo: str = ""
    ano_min: int | None = None
    ano_max: int | None = None
    preco_min: float | None = None
    preco_max: float | None = None
    km_max: int | None = None
    ufs: list[str] = field(default_factory=list)
    fontes: list[str] = field(default_factory=lambda: ["olx", "mercadolivre", "webmotors"])
    paginas: int = 2
    objetivo: str = "ambos"  # revenda, uso ou ambos

    @classmethod
    def de_dict(cls, d: dict) -> "Busca":
        campos = cls.__dataclass_fields__
        dados = {k: v for k, v in d.items() if k in campos}
        dados["ufs"] = [u.upper() for u in dados.get("ufs", [])]
        return cls(**dados)

    @property
    def consulta(self) -> str:
        return " ".join(p for p in (self.marca, self.modelo, self.termo) if p).strip()

    def aceita(self, a: Anuncio) -> bool:
        """Filtro final: as fontes nem sempre respeitam todos os filtros da URL."""
        if not a.preco or a.preco <= 0:
            return False
        if self.preco_min and a.preco < self.preco_min:
            return False
        if self.preco_max and a.preco > self.preco_max:
            return False
        if a.ano and self.ano_min and a.ano < self.ano_min:
            return False
        if a.ano and self.ano_max and a.ano > self.ano_max:
            return False
        if a.km is not None and self.km_max and a.km > self.km_max:
            return False
        if self.ufs and a.uf and a.uf.upper() not in self.ufs:
            return False
        texto = normalizar(a.texto_completo)
        for parte in (self.marca, self.modelo):
            parte = normalizar(parte)
            if parte and parte not in texto and ALIAS_MARCA.get(parte, "\0") not in texto.replace("-", " "):
                return False
        return True


def criar_sessao() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": NAVEGADOR,
        "Accept-Language": "pt-BR,pt;q=0.9",
        "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
    })
    return s


class Fonte:
    nome = "base"

    def __init__(self, sessao: requests.Session | None = None, pausa: float = 1.5):
        self.sessao = sessao or criar_sessao()
        self.pausa = pausa

    def _get(self, url: str, **kwargs) -> requests.Response:
        resp = self.sessao.get(url, timeout=30, **kwargs)
        if resp.status_code in (401, 403):
            raise PermissionError(
                f"{self.nome}: acesso negado ({resp.status_code}). O site pode estar "
                "bloqueando robôs; veja o README (seção Fontes)."
            )
        resp.raise_for_status()
        if self.pausa:
            time.sleep(self.pausa)
        return resp

    def buscar(self, busca: Busca) -> list[Anuncio]:
        raise NotImplementedError
