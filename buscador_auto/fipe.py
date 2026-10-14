"""Consulta da tabela FIPE (API pública parallelum) com cache local e
correspondência aproximada entre o nome do anúncio e o modelo FIPE."""

from __future__ import annotations

import json
import logging
import sqlite3
import time
from pathlib import Path

import requests

from .modelos import ResultadoFipe
from .texto import ler_numero, normalizar, tokens

log = logging.getLogger(__name__)

URL_V1 = "https://parallelum.com.br/fipe/api/v1"
URL_V2 = "https://fipe.parallelum.com.br/api/v2"
_TIPO_V2 = {"carros": "cars", "caminhoes": "trucks", "motos": "motorcycles"}

DIA = 86400

ALIAS_MARCA = {
    "vw": "volkswagen",
    "volks": "volkswagen",
    "gm": "chevrolet",
    "chevy": "chevrolet",
    "mb": "mercedes benz",
    "m benz": "mercedes benz",
    "mercedes": "mercedes benz",
    "mercedes-benz": "mercedes benz",
    "caoa chery": "chery",
    "land": "land rover",
    "vw caminhoes": "volkswagen",
}

# Palavras que pouco distinguem um modelo do outro.
RUIDO = {
    "p", "v", "mi", "mpi", "flex", "total", "totalflex", "flexpower", "diesel",
    "gasolina", "alcool", "mec", "aut", "manual", "automatico", "automatica",
    "cv", "de", "com", "c", "cab", "hp", "novo", "nova", "mod", "and", "the",
}
_GENERICOS_MARCA = {"motors", "motor", "do", "brasil", "caminhoes", "onibus", "automoveis"}


def _peso(tok: str, primeiro: bool) -> float:
    if tok in RUIDO or (tok[-1] in "vp" and tok[:-1].isdigit()):
        return 0.3
    if len(tok) >= 2 and tok[0] == "e" and tok[1:].isdigit():
        return 0.3
    if primeiro:
        return 4.0
    if tok[0].isdigit():
        return 2.0 if "x" in tok else 3.0
    return 1.0 if len(tok) == 1 else 1.5


def pontuar_modelo(texto_anuncio: str, nome_fipe: str, ignorar: set[str] = frozenset()) -> float:
    """Quão bem o modelo FIPE descreve o anúncio (0 a 1).

    Combina a parte do nome FIPE presente no anúncio (precisão, peso maior)
    com a parte do anúncio presente no nome FIPE (cobertura). Se a família do
    modelo (primeira palavra do nome FIPE, ex.: "Gol", "Actros", "R") não
    aparecer no anúncio, a nota cai bastante.
    """
    tf = tokens(nome_fipe)
    ta = [t for t in tokens(texto_anuncio) if t not in ignorar]
    if not tf or not ta:
        return 0.0
    conj_a, conj_f = set(ta), set(tf)
    peso_f = [_peso(t, i == 0) for i, t in enumerate(tf)]
    total_f = sum(peso_f)
    acerto_f = sum(p for t, p in zip(tf, peso_f) if t in conj_a)
    peso_a = [_peso(t, i == 0) for i, t in enumerate(ta)]
    total_a = sum(peso_a)
    acerto_a = sum(p for t, p in zip(ta, peso_a) if t in conj_f)
    prec, cob = acerto_f / total_f, acerto_a / total_a
    if prec + cob == 0:
        return 0.0
    beta2 = 0.25  # dá o dobro de importância à precisão
    nota = (1 + beta2) * prec * cob / (beta2 * prec + cob)
    if tf[0] not in conj_a:
        nota *= 0.35
    return round(nota, 4)


def pontuar_marca(marca_anuncio: str, nome_fipe: str) -> float:
    a = normalizar(marca_anuncio).replace("-", " ")
    a = ALIAS_MARCA.get(a, a)
    f = normalizar(nome_fipe).replace("-", " ")
    if not a:
        return 0.0
    if a == f:
        return 1.0
    ta = set(a.split()) - _GENERICOS_MARCA
    tf = set(f.split()) - _GENERICOS_MARCA
    if not ta:
        return 0.0
    return 0.99 * len(ta & tf) / len(ta)


class ClienteFipe:
    def __init__(
        self,
        cache: str | Path | None = "dados/cache_fipe.db",
        versao: int = 1,
        token: str | None = None,
        url_base: str | None = None,
        sessao: requests.Session | None = None,
        pausa: float = 0.4,
        tentativas: int = 3,
    ):
        self.versao = versao
        self.url_base = (url_base or (URL_V2 if versao == 2 else URL_V1)).rstrip("/")
        self.sessao = sessao or requests.Session()
        if token:
            self.sessao.headers["X-Subscription-Token"] = token
        self.pausa = pausa
        self.tentativas = tentativas
        self._db = None
        if cache:
            Path(cache).parent.mkdir(parents=True, exist_ok=True)
            self._db = sqlite3.connect(str(cache))
            self._db.execute(
                "CREATE TABLE IF NOT EXISTS cache (chave TEXT PRIMARY KEY, valor TEXT, criado REAL)"
            )
        self._memoria: dict[str, object] = {}

    # ------------------------------------------------------------------ HTTP
    def _get(self, caminho: str, ttl: float):
        if caminho in self._memoria:
            return self._memoria[caminho]
        if self._db is not None:
            linha = self._db.execute(
                "SELECT valor, criado FROM cache WHERE chave = ?", (caminho,)
            ).fetchone()
            if linha and time.time() - linha[1] < ttl:
                dado = json.loads(linha[0])
                self._memoria[caminho] = dado
                return dado
        url = f"{self.url_base}/{caminho}"
        espera = 2.0
        for tentativa in range(self.tentativas):
            resp = self.sessao.get(url, timeout=30)
            if resp.status_code == 429 and tentativa < self.tentativas - 1:
                log.warning("FIPE: limite de consultas atingido, aguardando %.0fs", espera)
                time.sleep(espera)
                espera *= 2
                continue
            resp.raise_for_status()
            break
        dado = resp.json()
        if self.pausa:
            time.sleep(self.pausa)
        self._memoria[caminho] = dado
        if self._db is not None:
            self._db.execute(
                "INSERT OR REPLACE INTO cache VALUES (?, ?, ?)",
                (caminho, json.dumps(dado), time.time()),
            )
            self._db.commit()
        return dado

    def _tipo(self, tipo: str) -> str:
        return _TIPO_V2.get(tipo, tipo) if self.versao == 2 else tipo

    @staticmethod
    def _lista(dado) -> list[dict]:
        """Converte respostas v1 ({nome, codigo}) e v2 ({name, code}) em {nome, codigo}."""
        if isinstance(dado, dict):
            dado = dado.get("modelos") or dado.get("models") or []
        return [
            {"nome": str(d.get("nome", d.get("name", ""))), "codigo": str(d.get("codigo", d.get("code", "")))}
            for d in dado
        ]

    # ------------------------------------------------------------- consultas
    def marcas(self, tipo: str) -> list[dict]:
        seg = "brands" if self.versao == 2 else "marcas"
        return self._lista(self._get(f"{self._tipo(tipo)}/{seg}", 30 * DIA))

    def modelos(self, tipo: str, marca: str) -> list[dict]:
        if self.versao == 2:
            return self._lista(self._get(f"{self._tipo(tipo)}/brands/{marca}/models", 30 * DIA))
        return self._lista(self._get(f"{tipo}/marcas/{marca}/modelos", 30 * DIA))

    def anos(self, tipo: str, marca: str, modelo: str) -> list[dict]:
        if self.versao == 2:
            caminho = f"{self._tipo(tipo)}/brands/{marca}/models/{modelo}/years"
        else:
            caminho = f"{tipo}/marcas/{marca}/modelos/{modelo}/anos"
        return self._lista(self._get(caminho, 30 * DIA))

    def preco(self, tipo: str, marca: str, modelo: str, ano: str) -> dict:
        if self.versao == 2:
            caminho = f"{self._tipo(tipo)}/brands/{marca}/models/{modelo}/years/{ano}"
        else:
            caminho = f"{tipo}/marcas/{marca}/modelos/{modelo}/anos/{ano}"
        d = self._get(caminho, 20 * DIA)
        return {
            "valor": ler_numero(d.get("Valor", d.get("price"))),
            "modelo": d.get("Modelo", d.get("model", "")),
            "codigo": d.get("CodigoFipe", d.get("codeFipe", "")),
            "mes": (d.get("MesReferencia", d.get("referenceMonth", "")) or "").strip(),
            "ano": d.get("AnoModelo", d.get("modelYear")),
        }

    # ------------------------------------------------------- correspondência
    def achar_marca(self, tipo: str, marca: str, texto: str = "") -> dict | None:
        marcas = self.marcas(tipo)
        if marca:
            melhor = max(marcas, key=lambda m: pontuar_marca(marca, m["nome"]), default=None)
            if melhor and pontuar_marca(marca, melhor["nome"]) >= 0.5:
                return melhor
        # Sem marca (ou marca não reconhecida): procura o nome da marca no título.
        palavras = set(normalizar(texto).replace("-", " ").split())
        palavras |= {ALIAS_MARCA[p] for p in palavras if p in ALIAS_MARCA}
        for m in marcas:
            nome = normalizar(m["nome"]).replace("-", " ")
            partes = [p for p in nome.split() if len(p) >= 3 and p not in _GENERICOS_MARCA]
            if partes and (nome in palavras or any(p in palavras for p in partes)):
                return m
        return None

    def buscar(
        self,
        tipo: str,
        marca: str,
        texto_modelo: str,
        ano: int | None,
        combustivel: str = "",
        ano_atual: int | None = None,
        titulo: str = "",
    ) -> ResultadoFipe | None:
        """Acha o valor FIPE mais provável para o veículo descrito."""
        if not ano:
            return None
        m = self.achar_marca(tipo, marca, f"{titulo} {texto_modelo}")
        if not m:
            log.info("FIPE: marca não encontrada para %r / %r", marca, titulo)
            return None
        ignorar = {str(ano), str(ano - 1)} | set(tokens(m["nome"]))
        # Modelo curto ("FH", "Onix") não distingue versões: completa com o título.
        uteis = [t for t in tokens(texto_modelo) if t not in RUIDO and t not in ignorar]
        texto = texto_modelo if len(uteis) >= 3 or not titulo else f"{texto_modelo} {titulo}"
        candidatos = sorted(
            ((pontuar_modelo(texto, mod["nome"], ignorar), mod) for mod in self.modelos(tipo, m["codigo"])),
            key=lambda x: -x[0],
        )
        comb = normalizar(combustivel)
        preferido = "diesel" if tipo == "caminhoes" else ("alcool" if "alcool" in comb or "etanol" in comb else "")
        if "diesel" in comb:
            preferido = "diesel"
        for nota, mod in candidatos[:4]:
            if nota < 0.3:
                break
            anos = self.anos(tipo, m["codigo"], mod["codigo"])
            do_ano = [a for a in anos if a["codigo"].split("-")[0] == str(ano)]
            if not do_ano and ano_atual and ano >= ano_atual:
                do_ano = [a for a in anos if a["codigo"].startswith("32000")]  # zero km
            if not do_ano:
                continue
            escolhido = next((a for a in do_ano if preferido and preferido in normalizar(a["nome"])), do_ano[0])
            p = self.preco(tipo, m["codigo"], mod["codigo"], escolhido["codigo"])
            if not p["valor"]:
                continue
            return ResultadoFipe(
                valor=p["valor"],
                modelo=f'{m["nome"]} {p["modelo"] or mod["nome"]}',
                codigo=p["codigo"],
                mes_referencia=p["mes"],
                ano_modelo=int(p["ano"] or ano),
                confianca=nota,
            )
        log.info("FIPE: modelo/ano não encontrado para %r %r %s", marca, texto, ano)
        return None
