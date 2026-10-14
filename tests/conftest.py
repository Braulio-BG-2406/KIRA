import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from buscador_auto.fipe import ClienteFipe  # noqa: E402


class RespostaFalsa:
    def __init__(self, dado, status=200):
        self.dado = dado
        self.status_code = status
        self.ok = status < 400
        self.text = json.dumps(dado) if not isinstance(dado, str) else dado

    def json(self):
        return self.dado

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class SessaoFalsa:
    """Responde por sufixo de URL; guarda as URLs pedidas."""

    def __init__(self, rotas: dict):
        self.rotas = rotas
        self.pedidos = []
        self.headers = {}

    def get(self, url, timeout=None, params=None):
        self.pedidos.append((url, params))
        for sufixo, dado in self.rotas.items():
            if url.endswith(sufixo):
                return RespostaFalsa(dado)
        return RespostaFalsa({"error": "not found"}, 404)

    def post(self, url, json=None, timeout=None):
        self.pedidos.append((url, json))
        return RespostaFalsa({"ok": True})


FIPE_V1 = {
    # caminhões
    "caminhoes/marcas": [
        {"nome": "DAF", "codigo": "206"},
        {"nome": "MERCEDES-BENZ", "codigo": "116"},
        {"nome": "SCANIA", "codigo": "122"},
        {"nome": "VOLVO", "codigo": "124"},
    ],
    "caminhoes/marcas/122/modelos": {"modelos": [
        {"nome": "R-440 A 6x2 2p (diesel)(E5)", "codigo": 1},
        {"nome": "R-450 A 4x2 2p (diesel)(E5)", "codigo": 2},
        {"nome": "R-450 A 6x2 2p (diesel)(E5)", "codigo": 3},
        {"nome": "R-450 A 6x4 2p (diesel)(E5)", "codigo": 4},
        {"nome": "G-420 A 6x2 2p (diesel)", "codigo": 5},
    ], "anos": []},
    "caminhoes/marcas/122/modelos/3/anos": [
        {"nome": "2019 Diesel", "codigo": "2019-3"},
        {"nome": "2018 Diesel", "codigo": "2018-3"},
    ],
    "caminhoes/marcas/122/modelos/3/anos/2019-3": {
        "Valor": "R$ 518.432,00", "Marca": "SCANIA", "Modelo": "R-450 A 6x2 2p (diesel)(E5)",
        "AnoModelo": 2019, "Combustivel": "Diesel", "CodigoFipe": "509153-4", "MesReferencia": "outubro de 2026 ",
    },
    # carros
    "carros/marcas": [
        {"nome": "Fiat", "codigo": "21"},
        {"nome": "GM - Chevrolet", "codigo": "23"},
        {"nome": "VW - VolksWagen", "codigo": "59"},
    ],
    "carros/marcas/59/modelos": {"modelos": [
        {"nome": "Gol (novo) 1.0 Mi Total Flex 8V 4p", "codigo": 10},
        {"nome": "Gol 1.0 Mi Total Flex 8V 4p", "codigo": 11},
        {"nome": "Gol Trend/ Power 1.0 Mi Total Flex 8V 4p", "codigo": 12},
        {"nome": "Gol 1.6 Mi Total Flex 8V 4p", "codigo": 13},
        {"nome": "Golf 1.4 TSI Highline", "codigo": 14},
        {"nome": "Polo 1.0 Flex 12V 5p", "codigo": 15},
    ], "anos": []},
    # O melhor candidato não tem 2018; o segundo tem.
    "carros/marcas/59/modelos/11/anos": [{"nome": "2014 Gasolina", "codigo": "2014-1"}],
    "carros/marcas/59/modelos/10/anos": [
        {"nome": "2018 Gasolina", "codigo": "2018-1"},
        {"nome": "2018 Álcool", "codigo": "2018-2"},
    ],
    "carros/marcas/59/modelos/10/anos/2018-1": {
        "Valor": "R$ 45.123,00", "Modelo": "Gol (novo) 1.0 Mi Total Flex 8V 4p", "AnoModelo": 2018,
        "CodigoFipe": "005340-6", "MesReferencia": "outubro de 2026",
    },
}


@pytest.fixture
def sessao_fipe():
    return SessaoFalsa(FIPE_V1)


@pytest.fixture
def cliente_fipe(sessao_fipe):
    return ClienteFipe(cache=None, sessao=sessao_fipe, pausa=0)
