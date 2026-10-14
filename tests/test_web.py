import http.client
import importlib.util
import json
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest

import buscador_auto.coleta as coleta
import buscador_auto.web as web
from buscador_auto.fontes.base import Fonte
from buscador_auto.modelos import Anuncio

RAIZ = Path(__file__).resolve().parents[1]


class FonteFalsa(Fonte):
    nome = "falsa"

    def buscar(self, busca):
        return [Anuncio("falsa", str(i), "BMW 320i GP 2019", 130000 + i * 10000, marca="BMW", ano=2019,
                        km=60000, uf="SP", fipe_informada=165000) for i in range(3)]


class FonteBloqueada(Fonte):
    nome = "bloqueada"

    def buscar(self, busca):
        raise PermissionError("bloqueada: acesso negado (403)")


class FipeNuncaChamada:
    def __init__(self, *a, **k):
        pass

    def buscar(self, *a, **k):
        raise AssertionError("a FIPE não deveria ser consultada neste teste")


@pytest.fixture
def servidor(tmp_path, monkeypatch):
    config = tmp_path / "buscas.toml"
    config.write_text(
        '[faixas.premium]\nmarcas = ["BMW"]\nfontes = ["falsa", "bloqueada"]\n'
        '[faixas.pesados]\ntermos = ["cavalo mecânico"]\nfontes = ["falsa"]\n',
        encoding="utf-8",
    )
    monkeypatch.setenv("BUSCAS_CONFIG", str(config))
    monkeypatch.delenv("SENHA_ACESSO", raising=False)
    monkeypatch.setattr(coleta, "FONTES", {"falsa": FonteFalsa, "bloqueada": FonteBloqueada})
    monkeypatch.setattr(web, "ClienteFipe", FipeNuncaChamada)
    monkeypatch.setattr(web.tempfile, "gettempdir", lambda: str(tmp_path))
    srv = ThreadingHTTPServer(("127.0.0.1", 0), web.HandlerLocal)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield srv.server_address[1]
    srv.shutdown()


def pedir(porta, metodo, caminho, corpo=None, headers=None):
    con = http.client.HTTPConnection("127.0.0.1", porta, timeout=10)
    if isinstance(corpo, (dict, list)):
        corpo = json.dumps(corpo).encode()
    con.request(metodo, caminho, body=corpo, headers=headers or {})
    r = con.getresponse()
    dado = r.read()
    con.close()
    if r.getheader("Content-Type", "").startswith("application/json"):
        return r.status, json.loads(dado)
    return r.status, dado.decode("utf-8", "replace")


def test_pagina_e_arquivos(servidor):
    status, html = pedir(servidor, "GET", "/")
    assert status == 200 and 'const MODO = "app";' in html
    assert pedir(servidor, "GET", "/../README.md")[0] == 404
    assert pedir(servidor, "GET", "/%2e%2e/buscador_auto/web.py")[0] == 404
    assert pedir(servidor, "GET", "/api/nada")[0] == 404


def test_listar_e_rodar_busca(servidor):
    status, dado = pedir(servidor, "GET", "/api/buscas")
    assert status == 200
    assert [(b["nome"], b["faixa"]) for b in dado["buscas"]] == [
        ("Pesados · cavalo mecânico", "pesados"), ("Premium · BMW", "premium")]

    status, dado = pedir(servidor, "GET", "/api/buscar?busca=" + "Premium%20%C2%B7%20BMW")
    assert status == 200
    assert len(dado["resultados"]) == 3 and {d["faixa"] for d in dado["resultados"]} == {"premium"}
    assert dado["fontes"][0] == {"fonte": "falsa", "achados": 3, "aceitos": 3}
    assert dado["fontes"][1]["erro"] == "bloqueada: acesso negado (403)"
    assert dado["resultados"][0]["mediana_mercado"] is not None  # comparou com os outros 320i

    # Caminhão nenhum: os BMW da fonte falsa não entram na faixa pesados.
    status, dado = pedir(servidor, "GET", "/api/buscar?busca=Pesados%20%C2%B7%20cavalo%20mec%C3%A2nico")
    assert status == 200 and dado["resultados"] == []

    status, dado = pedir(servidor, "GET", "/api/buscar?busca=inexistente")
    assert status == 400 and "não encontrada" in dado["erro"]


def test_avaliar(servidor):
    status, dado = pedir(servidor, "POST", "/api/avaliar", {
        "titulo": "Scania R 450 A 6x2", "preco": "410.000", "ano": "2019", "km": "520.000",
        "fipe": "520.000", "descricao": "único dono, aceito proposta", "vendedor": "particular"})
    assert status == 200
    d = dado["resultados"][0]
    assert (d["faixa"], d["categoria"], d["preco"], d["fipe"]) == ("pesados", "cavalo", 410000.0, 520000.0)
    assert d["fonte"] == "manual" and "aceita proposta" in d["sinais"]

    assert pedir(servidor, "POST", "/api/avaliar", b"{quebrado", {"Content-Type": "application/json"})[0] == 400
    status, dado = pedir(servidor, "POST", "/api/avaliar", {"titulo": "Gol"})
    assert status == 400 and "preço" in dado["erro"]


def test_importar(servidor):
    status, dado = pedir(servidor, "POST", "/api/importar?exemplo=1")
    assert status == 200 and len(dado["resultados"]) == 26
    faixa = {d["titulo"]: d["faixa"] for d in dado["resultados"]}
    # A config do teste só tem BMW no premium: Audi e Mercedes ficam em "outros".
    assert faixa["BMW 320i GP 2.0 Turbo 2019"] == "premium"
    assert faixa["Audi A3 Sedan 1.4 TFSI 2018"] == "outros"
    assert faixa["Volvo FH 540 6x4 2018"] == "pesados" and faixa["Fiat Argo Drive 1.0 2021"] == "populares"

    csv = "titulo;preco;ano;km;fipe\nFiat Argo Drive 1.0;69.900;2021;55000;70.000\n".encode("utf-8")
    status, dado = pedir(servidor, "POST", "/api/importar", csv, {"X-Arquivo": "leil%C3%A3o%20maio.csv"})
    assert status == 200
    d = dado["resultados"][0]
    assert (d["faixa"], d["busca"], d["fonte"]) == ("populares", "leilão maio.csv", "leilão maio")

    assert pedir(servidor, "POST", "/api/importar")[0] == 400
    assert pedir(servidor, "POST", "/api/importar", b"a;b\n1;2\n")[0] == 400


def test_senha(servidor, monkeypatch):
    monkeypatch.setenv("SENHA_ACESSO", "segredo")
    assert pedir(servidor, "GET", "/api/buscas")[0] == 401
    assert pedir(servidor, "GET", "/api/buscas", headers={"X-Senha": "errada"})[0] == 401
    assert pedir(servidor, "GET", "/api/buscas", headers={"X-Senha": "segredo"})[0] == 200
    assert pedir(servidor, "GET", "/")[0] == 200  # a página abre; a senha é pedida ao usar


def test_fipe_tem_prazo():
    class Lenta:
        def buscar(self, *a, **k):
            return "ok"
    com_prazo = web._FipeComPrazo(Lenta(), 60)
    assert com_prazo.buscar() == "ok"
    vencido = web._FipeComPrazo(Lenta(), -1)
    assert vencido.buscar() is None


def test_pagina_publicada_esta_atualizada(tmp_path):
    gerada = web.gerar_pagina(tmp_path / "index.html").read_text(encoding="utf-8")
    publicada = (RAIZ / "public" / "index.html").read_text(encoding="utf-8")
    assert gerada == publicada, "rode: python -m buscador_auto gerar-site"


@pytest.mark.parametrize("nome", ["buscas", "buscar", "avaliar", "importar"])
def test_funcoes_da_vercel(nome):
    spec = importlib.util.spec_from_file_location(f"api_{nome}", RAIZ / "api" / f"{nome}.py")
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    assert issubclass(modulo.handler, web.Handler)


def test_vercel_json():
    conf = json.loads((RAIZ / "vercel.json").read_text(encoding="utf-8"))
    assert conf["outputDirectory"] == "public"
    assert conf["functions"]["api/*.py"]["maxDuration"] <= 60


def test_erros_das_fontes_em_portugues():
    import requests
    from buscador_auto.coleta import explicar_erro
    assert explicar_erro(requests.ConnectionError("HTTPSConnectionPool(...)")) == "não foi possível conectar ao site"
    assert explicar_erro(requests.Timeout()) == "o site demorou demais para responder"
    assert explicar_erro(PermissionError("olx: acesso negado (403)")) == "olx: acesso negado (403)"
