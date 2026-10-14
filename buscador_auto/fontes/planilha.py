"""Importa anúncios de uma planilha CSV ou Excel.

Serve para qualquer origem sem robô: leilões, Facebook Marketplace, grupos de
WhatsApp, lojistas parceiros. Colunas reconhecidas (só "preco" e "titulo" ou
"modelo" são obrigatórias): titulo, preco, marca, modelo, versao, ano, km,
cidade, uf, url, descricao, categoria, vendedor, combustivel, fipe, fonte, id.
"""

from __future__ import annotations

import csv
import datetime as dt
import hashlib
from pathlib import Path

from ..modelos import Anuncio
from ..texto import ler_ano, ler_km, ler_numero, ler_uf, normalizar

SINONIMOS = {
    "titulo": "titulo", "anuncio": "titulo", "veiculo": "titulo", "nome": "titulo",
    "preco": "preco", "valor": "preco", "preco pedido": "preco", "lance": "preco",
    "marca": "marca", "fabricante": "marca",
    "modelo": "modelo", "versao": "versao",
    "ano": "ano", "ano modelo": "ano", "ano/modelo": "ano", "ano fab/mod": "ano",
    "km": "km", "quilometragem": "km", "kms": "km", "hodometro": "km",
    "cidade": "cidade", "municipio": "cidade",
    "uf": "uf", "estado": "uf",
    "url": "url", "link": "url",
    "descricao": "descricao", "observacoes": "descricao", "obs": "descricao",
    "categoria": "categoria", "tipo": "categoria",
    "vendedor": "vendedor", "origem": "vendedor",
    "combustivel": "combustivel",
    "fipe": "fipe", "valor fipe": "fipe", "tabela fipe": "fipe",
    "fonte": "fonte", "site": "fonte",
    "id": "id", "codigo": "id", "lote": "id",
}


def _linhas_csv(caminho: Path) -> list[dict]:
    texto = caminho.read_text(encoding="utf-8-sig", errors="replace")
    try:
        dialeto = csv.Sniffer().sniff(texto[:4096], delimiters=";,\t")
    except csv.Error:
        dialeto = csv.excel
    return list(csv.DictReader(texto.splitlines(), dialect=dialeto))


def _linhas_excel(caminho: Path) -> list[dict]:
    try:
        from openpyxl import load_workbook
    except ImportError as erro:  # pragma: no cover
        raise SystemExit("Para ler .xlsx instale o openpyxl: pip install openpyxl") from erro
    folha = load_workbook(caminho, read_only=True, data_only=True).active
    linhas = folha.iter_rows(values_only=True)
    cabecalho = [str(c or "") for c in next(linhas, [])]
    return [dict(zip(cabecalho, linha)) for linha in linhas if any(v not in (None, "") for v in linha)]


def ler_planilha(caminho: str | Path, ano_atual: int | None = None) -> list[Anuncio]:
    caminho = Path(caminho)
    ano_atual = ano_atual or dt.date.today().year
    brutas = _linhas_excel(caminho) if caminho.suffix.lower() in (".xlsx", ".xlsm") else _linhas_csv(caminho)
    anuncios = []
    for n, bruta in enumerate(brutas, start=2):
        linha = {}
        for chave, valor in bruta.items():
            campo = SINONIMOS.get(normalizar(chave))
            if campo and valor not in (None, ""):
                linha[campo] = valor if not isinstance(valor, str) else valor.strip()
        preco = ler_numero(linha.get("preco"))
        titulo = str(linha.get("titulo") or " ".join(
            str(linha.get(c, "")) for c in ("marca", "modelo", "versao", "ano")).strip())
        if not preco or not titulo:
            continue
        ident = str(linha.get("id") or hashlib.md5(f"{titulo}|{preco}|{linha.get('url', '')}".encode()).hexdigest()[:12])
        anuncios.append(Anuncio(
            fonte=str(linha.get("fonte") or caminho.stem),
            id=ident,
            titulo=titulo,
            preco=preco,
            url=str(linha.get("url") or ""),
            marca=str(linha.get("marca") or ""),
            modelo=str(linha.get("modelo") or ""),
            versao=str(linha.get("versao") or ""),
            ano=ler_ano(linha.get("ano") or titulo, ano_atual),
            km=ler_km(linha.get("km")),
            cidade=str(linha.get("cidade") or ""),
            uf=ler_uf(linha.get("uf") or ""),
            descricao=str(linha.get("descricao") or ""),
            categoria=str(linha.get("categoria") or ""),
            vendedor=str(linha.get("vendedor") or ""),
            combustivel=str(linha.get("combustivel") or ""),
            fipe_informada=ler_numero(linha.get("fipe")),
        ))
    return anuncios
