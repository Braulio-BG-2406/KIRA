"""Leitura do arquivo de buscas (TOML) com valores padrão."""

from __future__ import annotations

import os
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:  # Python < 3.11
    import tomli as tomllib  # type: ignore[no-redef]

from .fontes.base import Busca

PADRAO = {
    "geral": {
        "saida": "saida",
        "banco": "dados/buscador_auto.db",
        "pausa_entre_requisicoes": 1.5,
        "score_minimo_alerta": 70,
        "limite_terminal": 20,
    },
    "fipe": {"versao": 1, "token": "", "cache": "dados/cache_fipe.db"},
    "telegram": {"token": "", "chat_id": ""},
    "mercadolivre": {"token": ""},
    "custos": {},
    "buscas": [],
}


def carregar(caminho: str | Path | None) -> dict:
    config = {k: (dict(v) if isinstance(v, dict) else list(v)) for k, v in PADRAO.items()}
    if caminho:
        with open(caminho, "rb") as f:
            dado = tomllib.load(f)
        for chave, valor in dado.items():
            if isinstance(valor, dict) and isinstance(config.get(chave), dict):
                config[chave].update(valor)
            else:
                config[chave] = valor
    # Segredos também podem vir de variáveis de ambiente.
    config["fipe"]["token"] = config["fipe"]["token"] or os.environ.get("FIPE_TOKEN", "")
    config["telegram"]["token"] = config["telegram"]["token"] or os.environ.get("TELEGRAM_BOT_TOKEN", "")
    config["telegram"]["chat_id"] = str(config["telegram"]["chat_id"] or os.environ.get("TELEGRAM_CHAT_ID", ""))
    config["mercadolivre"]["token"] = config["mercadolivre"]["token"] or os.environ.get("ML_ACCESS_TOKEN", "")
    return config


def buscas(config: dict) -> list[Busca]:
    return [Busca.de_dict(b) for b in config.get("buscas", [])]
