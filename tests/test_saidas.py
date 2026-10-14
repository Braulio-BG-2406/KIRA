import json
import re
import shutil
from pathlib import Path

from buscador_auto.__main__ import main
from buscador_auto.avaliacao import avaliar
from buscador_auto.historico import Historico
from buscador_auto.modelos import Anuncio, ResultadoFipe
from buscador_auto.notificacao import enviar_telegram, mensagem
from buscador_auto.relatorio import salvar_csv, salvar_html

from .conftest import SessaoFalsa

EXEMPLO = Path(__file__).resolve().parents[1] / "exemplos" / "anuncios_exemplo.csv"


def avaliacao(preco=52000, titulo="Onix LT <b>2020</b>", url="https://x/1"):
    a = Anuncio("olx", "1", titulo, preco, url=url, marca="Chevrolet", modelo="Onix", ano=2020, km=97500)
    return avaliar(a, "carro", ResultadoFipe(72000, "Onix", "1", "out/2026", 2020, 0.9), None, 0, ano_atual=2026)


def test_historico_novo_queda_e_notificacao():
    h = Historico(":memory:")
    av = avaliacao(60000)
    h.registrar([av], agora=1)
    assert av.novo and av.queda_preco == 0
    assert h.para_notificar([av], 0) == [av]
    h.marcar_notificado(av)
    assert h.para_notificar([av], 0) == []

    mais_barato = avaliacao(55000)
    h.registrar([mais_barato], agora=2)
    assert not mais_barato.novo and mais_barato.queda_preco == 5000
    assert h.para_notificar([mais_barato], 0) == [mais_barato]  # baixou depois do aviso


def test_mensagem_telegram_escapa_html():
    texto = mensagem(avaliacao())
    assert "&lt;b&gt;2020&lt;/b&gt;" in texto
    assert '<a href="https://x/1">' in texto
    sessao = SessaoFalsa({})
    assert enviar_telegram("TOKEN", "42", texto, sessao=sessao)
    url, corpo = sessao.pedidos[0]
    assert url == "https://api.telegram.org/botTOKEN/sendMessage" and corpo["chat_id"] == "42"


def test_html_seguro_e_com_dados(tmp_path):
    av = avaliacao(titulo="</script><script>alert(1)</script>", url="javascript:alert(1)")
    caminho = salvar_html([av], tmp_path / "r.html", "Teste <i>", "aviso & cia")
    html = caminho.read_text(encoding="utf-8")
    assert "<title>Teste &lt;i&gt;</title>" in html and "aviso &amp; cia" in html
    bloco = re.search(r'<script id="dados" type="application/json">(.*?)</script>', html, re.S).group(1)
    dados = json.loads(bloco)
    assert dados[0]["titulo"] == "</script><script>alert(1)</script>"
    assert dados[0]["revenda"] == "ÓTIMA"


def test_csv(tmp_path):
    caminho = salvar_csv([avaliacao()], tmp_path / "r.csv")
    linhas = caminho.read_text(encoding="utf-8-sig").splitlines()
    assert linhas[0].startswith("score;revenda;uso;")
    assert ";52000,00;" in linhas[1]


def test_cli_importar_exemplo(tmp_path, monkeypatch, capsys):
    shutil.copy(EXEMPLO, tmp_path / "anuncios.csv")
    (tmp_path / "buscas.toml").write_text('[geral]\nsaida = "relatorios"\nbanco = "dados/h.db"\n', encoding="utf-8")
    monkeypatch.chdir(tmp_path)
    assert main(["importar", "anuncios.csv", "--sem-fipe"]) == 0
    saida = capsys.readouterr().out
    assert "20 anúncios lidos" in saida
    html = (tmp_path / "relatorios" / "ultimo.html").read_text(encoding="utf-8")
    dados = json.loads(re.search(r'<script id="dados" type="application/json">(.*?)</script>', html, re.S).group(1))
    assert len(dados) == 20
    por_titulo = {d["titulo"]: d for d in dados}
    assert {d["categoria"] for d in dados} == {"carro", "caminhao", "cavalo"}
    assert por_titulo["Fiat Strada Freedom 1.3 2021"]["revenda"] == "RISCO"
    assert por_titulo["Scania R 450 A 6x2 cavalo mecânico 2019"]["categoria"] == "cavalo"
    assert por_titulo["VW Constellation 24.280 6x2 baú 2016"]["categoria"] == "caminhao"
    assert dados[0]["score"] >= dados[-1]["score"]


def test_cli_avaliar(capsys):
    assert main(["avaliar", "--titulo", "Scania R 450 A 6x2", "--ano", "2019", "--km", "520000",
                 "--preco", "410000", "--fipe", "520000", "--sem-fipe"]) == 0
    saida = capsys.readouterr().out
    assert "Cavalo mecânico" in saida and "Veredito revenda" in saida


def test_cli_buscar_sem_config(tmp_path, monkeypatch, capsys):
    monkeypatch.chdir(tmp_path)
    assert main(["buscar"]) == 2
    assert "buscas.exemplo.toml" in capsys.readouterr().err


def test_cli_buscar_com_fonte_falsa_e_telegram(tmp_path, monkeypatch, capsys):
    import buscador_auto.__main__ as cli
    from buscador_auto.fontes.base import Fonte

    class FonteFalsa(Fonte):
        nome = "falsa"

        def buscar(self, busca):
            return [
                Anuncio("falsa", "1", "Scania R 450 A 6x2 2019", 410000, marca="Scania", ano=2019, km=500000,
                        uf="PR", fipe_informada=520000, descricao="único dono, aceito proposta"),
                Anuncio("falsa", "2", "Scania R 450 A 6x2 2019", 900000, uf="PR", fipe_informada=520000),  # fora do filtro
                Anuncio("falsa", "3", "Scania R 450 A 6x2 2019", 400000, uf="SP", fipe_informada=520000),  # outra UF
            ]

    class FonteQuebrada(Fonte):
        nome = "quebrada"

        def buscar(self, busca):
            raise PermissionError("403")

    enviados = []
    monkeypatch.setattr(cli, "FONTES", {"falsa": FonteFalsa, "quebrada": FonteQuebrada})
    monkeypatch.setattr(cli, "enviar_telegram", lambda token, chat, texto: enviados.append(texto) or True)
    (tmp_path / "buscas.toml").write_text(
        '[geral]\nsaida = "s"\nbanco = "d/h.db"\nscore_minimo_alerta = 60\npausa_entre_requisicoes = 0\n'
        '[telegram]\ntoken = "T"\nchat_id = "1"\n'
        '[[buscas]]\nnome = "Cavalos PR"\ncategoria = "cavalo"\npreco_max = 600000\nufs = ["PR"]\n'
        'fontes = ["falsa", "quebrada", "inexistente"]\n',
        encoding="utf-8",
    )
    monkeypatch.chdir(tmp_path)
    assert main(["buscar", "--notificar", "--sem-fipe"]) == 0
    saida = capsys.readouterr().out
    assert "[Cavalos PR] falsa: 3 anúncios, 1 dentro dos filtros" in saida
    assert len(enviados) == 1 and "Scania R 450" in enviados[0]

    # Segunda execução: mesmo anúncio, mesmo preço -> não avisa de novo.
    assert main(["buscar", "--notificar", "--sem-fipe"]) == 0
    assert len(enviados) == 1
