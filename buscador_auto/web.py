"""Versão web do buscador: API usada pelas funções da Vercel (pasta api/) e
por um servidor local (`python -m buscador_auto servir`).

Rotas:
    GET  /api/buscas              lista as buscas das faixas
    GET  /api/buscar?busca=NOME   roda uma busca e devolve os anúncios avaliados
    POST /api/avaliar             avalia um anúncio (JSON)
    POST /api/importar            avalia uma planilha CSV/XLSX (corpo = arquivo)
    POST /api/importar?exemplo=1  avalia a planilha de exemplo (dados fictícios)

Se a variável de ambiente SENHA_ACESSO existir, toda chamada precisa do
cabeçalho X-Senha com o mesmo valor.
"""

from __future__ import annotations

import datetime as dt
import hmac
import json
import logging
import mimetypes
import os
import tempfile
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from . import config as cfg_mod
from .avaliacao import avaliar_lote
from .coleta import coletar, montar_fontes
from .fipe import ClienteFipe
from .fontes import ler_planilha
from .modelos import Anuncio
from .relatorio import MODELO_HTML, para_dict
from .texto import ler_ano, ler_km, ler_numero

log = logging.getLogger(__name__)

RAIZ = Path(__file__).resolve().parents[1]
PUBLICO = RAIZ / "public"
EXEMPLO = RAIZ / "exemplos" / "anuncios_exemplo.csv"
LIMITE_CORPO = 4 * 1024 * 1024  # a Vercel aceita até 4,5 MB por requisição
PRAZO_FIPE = 40  # segundos; depois disso a busca segue só com o preço de mercado


class ErroPedido(Exception):
    """Erro causado pelo pedido (vira HTTP 400)."""


def carregar_config() -> dict:
    caminho = os.environ.get("BUSCAS_CONFIG")
    if not caminho:
        proprio = RAIZ / "buscas.toml"
        caminho = proprio if proprio.exists() else RAIZ / "buscas.exemplo.toml"
    config = cfg_mod.carregar(caminho)
    tmp = Path(tempfile.gettempdir())
    config["fipe"]["cache"] = str(tmp / "cache_fipe.db")  # única pasta gravável na Vercel
    if os.environ.get("FIPE_VERSAO"):
        config["fipe"]["versao"] = int(os.environ["FIPE_VERSAO"])
    config["geral"]["pausa_entre_requisicoes"] = float(os.environ.get("PAUSA_FONTES", "0.5"))
    return config


class _FipeComPrazo:
    """Depois do prazo, para de consultar a FIPE para não estourar o tempo da função."""

    def __init__(self, cliente: ClienteFipe, segundos: float):
        self.cliente = cliente
        self.limite = time.monotonic() + segundos

    def buscar(self, *args, **kwargs):
        if time.monotonic() > self.limite:
            return None
        return self.cliente.buscar(*args, **kwargs)


def _cliente_fipe(config: dict, sem_fipe: bool = False):
    if sem_fipe:
        return None
    f = config["fipe"]
    cliente = ClienteFipe(cache=f["cache"], versao=int(f.get("versao", 1)), token=f.get("token") or None, pausa=0.1)
    return _FipeComPrazo(cliente, PRAZO_FIPE)


def _resultado(anuncios: list[Anuncio], config: dict, sem_fipe: bool = False) -> list[dict]:
    return [para_dict(av) for av in avaliar_lote(anuncios, _cliente_fipe(config, sem_fipe), config)]


# ----------------------------------------------------------------------- rotas
def rota_buscas(query: dict, corpo: bytes, headers) -> dict:
    config = carregar_config()
    return {"buscas": [{"nome": b.nome, "faixa": b.faixa, "categoria": b.categoria, "fontes": b.fontes}
                       for b in cfg_mod.buscas(config)]}


def rota_buscar(query: dict, corpo: bytes, headers, fontes=None) -> dict:
    nome = (query.get("busca") or [""])[0]
    config = carregar_config()
    busca = next((b for b in cfg_mod.buscas(config) if b.nome == nome), None)
    if busca is None:
        raise ErroPedido(f"Busca não encontrada: {nome!r}")
    anuncios, resumo = coletar(busca, montar_fontes(config, fontes), config)
    unicos = list({a.chave: a for a in anuncios}.values())
    return {"busca": busca.nome, "faixa": busca.faixa, "fontes": resumo,
            "resultados": _resultado(unicos, config, sem_fipe="sem_fipe" in query)}


def _anuncio_do_formulario(d: dict) -> Anuncio:
    preco = ler_numero(d.get("preco"))
    titulo = str(d.get("titulo") or " ".join(str(d.get(c) or "") for c in ("marca", "modelo", "versao"))).strip()
    if not preco or not titulo:
        raise ErroPedido("Informe pelo menos o título (ou marca/modelo) e o preço.")
    ano_atual = dt.date.today().year
    return Anuncio(
        fonte="manual",
        id=f"manual-{int(time.time() * 1000)}",
        titulo=titulo,
        preco=preco,
        url=str(d.get("url") or ""),
        marca=str(d.get("marca") or ""),
        modelo=str(d.get("modelo") or ("" if d.get("marca") else titulo)),
        versao=str(d.get("versao") or ""),
        ano=ler_ano(d.get("ano") or titulo, ano_atual),
        km=ler_km(d.get("km")) if d.get("km") not in (None, "") else None,
        uf=str(d.get("uf") or "").upper(),
        descricao=str(d.get("descricao") or ""),
        categoria=str(d.get("categoria") or ""),
        vendedor=str(d.get("vendedor") or ""),
        fipe_informada=ler_numero(d.get("fipe")) if d.get("fipe") not in (None, "") else None,
    )


def rota_avaliar(query: dict, corpo: bytes, headers) -> dict:
    try:
        dados = json.loads(corpo or b"{}")
    except ValueError as erro:
        raise ErroPedido("JSON inválido") from erro
    if not isinstance(dados, dict):
        raise ErroPedido("Envie um objeto JSON com os dados do anúncio.")
    config = carregar_config()
    return {"resultados": _resultado([_anuncio_do_formulario(dados)], config)}


def rota_importar(query: dict, corpo: bytes, headers) -> dict:
    config = carregar_config()
    if "exemplo" in query:
        anuncios = ler_planilha(EXEMPLO)
        for a in anuncios:
            a.busca = "exemplo (fictício)"
        return {"resultados": _resultado(anuncios, config, sem_fipe=True)}
    if not corpo:
        raise ErroPedido("Envie o arquivo da planilha (CSV ou XLSX).")
    nome = Path(unquote(headers.get("X-Arquivo") or "planilha.csv")).name
    sufixo = ".xlsx" if corpo[:2] == b"PK" else ".csv"
    with tempfile.TemporaryDirectory() as pasta:
        caminho = Path(pasta) / f"planilha{sufixo}"
        caminho.write_bytes(corpo)
        try:
            anuncios = ler_planilha(caminho)
        except Exception as erro:
            raise ErroPedido(f"Não consegui ler a planilha: {erro}") from erro
    for a in anuncios:
        a.busca = nome
        if a.fonte == "planilha":
            a.fonte = Path(nome).stem
    if not anuncios:
        raise ErroPedido("Nenhuma linha com preço e título/modelo na planilha.")
    return {"resultados": _resultado(anuncios, config)}


ROTAS_GET = {"/api/buscas": rota_buscas, "/api/buscar": rota_buscar}
ROTAS_POST = {"/api/avaliar": rota_avaliar, "/api/importar": rota_importar}


# ------------------------------------------------------------------- servidor
class Handler(BaseHTTPRequestHandler):
    """Atende as rotas da API. Na Vercel cada arquivo de api/ usa esta classe;
    no servidor local ela também entrega a página de public/."""

    servir_pagina = False

    def do_GET(self):
        self._despachar(ROTAS_GET)

    def do_POST(self):
        self._despachar(ROTAS_POST)

    def _despachar(self, rotas: dict) -> None:
        url = urlparse(self.path)
        caminho = url.path.rstrip("/") or "/"
        funcao = rotas.get(caminho)
        if funcao is None:
            if self.command == "GET" and self.servir_pagina and not caminho.startswith("/api/"):
                return self._arquivo_estatico(caminho)
            return self._json(404, {"erro": "Rota não encontrada"})
        if not self._autorizado():
            return self._json(401, {"erro": "Senha de acesso incorreta"})
        tamanho = int(self.headers.get("Content-Length") or 0)
        if tamanho > LIMITE_CORPO:
            return self._json(413, {"erro": "Arquivo grande demais (máximo 4 MB)"})
        corpo = self.rfile.read(tamanho) if tamanho else b""
        try:
            self._json(200, funcao(parse_qs(url.query), corpo, self.headers))
        except ErroPedido as erro:
            self._json(400, {"erro": str(erro)})
        except Exception as erro:  # registra no log da Vercel e responde sem derrubar a função
            log.exception("Falha em %s", caminho)
            self._json(500, {"erro": f"Falha interna: {erro}"})

    def _autorizado(self) -> bool:
        senha = os.environ.get("SENHA_ACESSO")
        if not senha:
            return True
        return hmac.compare_digest((self.headers.get("X-Senha") or "").encode(), senha.encode())

    def _json(self, status: int, dado: dict) -> None:
        corpo = json.dumps(dado, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def _arquivo_estatico(self, caminho: str) -> None:
        alvo = (PUBLICO / (caminho.lstrip("/") or "index.html")).resolve()
        if alvo.is_dir():
            alvo = alvo / "index.html"
        if PUBLICO.resolve() not in alvo.parents or not alvo.is_file():
            return self._json(404, {"erro": "Arquivo não encontrado"})
        corpo = alvo.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(alvo.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)


class HandlerLocal(Handler):
    servir_pagina = True


def gerar_pagina(destino: Path = PUBLICO / "index.html") -> Path:
    """Gera a página do site a partir do mesmo modelo do relatório (modo app)."""
    html = (MODELO_HTML.read_text(encoding="utf-8")
            .replace("{{TITULO}}", "Buscador de oportunidades automotivas")
            .replace("{{GERADO}}", "")
            .replace("{{AVISO}}", "")
            .replace("{{MODO}}", "app")
            .replace("{{DADOS}}", "[]"))
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(html, encoding="utf-8")
    return destino


def servir(porta: int = 8000, host: str = "127.0.0.1") -> None:
    gerar_pagina()
    servidor = ThreadingHTTPServer((host, porta), HandlerLocal)
    print(f"Buscador no ar em http://{host}:{porta}  (Ctrl+C para parar)")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass
