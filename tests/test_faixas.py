from pathlib import Path

import pytest

from buscador_auto import config as cfg_mod
from buscador_auto.__main__ import main
from buscador_auto.coleta import da_faixa
from buscador_auto.avaliacao import avaliar
from buscador_auto.faixas import buscas_das_faixas, faixa_do_anuncio, perfil_custos
from buscador_auto.fontes.base import Busca, Fonte
from buscador_auto.modelos import Anuncio, ResultadoFipe

EXEMPLO_TOML = Path(__file__).resolve().parents[1] / "buscas.exemplo.toml"


@pytest.mark.parametrize("titulo, marca, preco, categoria, esperado", [
    ("Scania R 450 A 6x2", "Scania", 400000, "cavalo", "pesados"),
    ("Mercedes-Benz Actros 2651", "Mercedes-Benz", 600000, "cavalo", "pesados"),
    ("BMW 320i GP", "BMW", 130000, "carro", "premium"),
    ("Audi A3 Sedan", "", 98000, "carro", "premium"),
    ("Mercedes C 200", "Mercedes", 118000, "carro", "premium"),
    ("Mercedes-Benz Sprinter 415 furgão", "Mercedes-Benz", 150000, "carro", "outros"),
    ("Chevrolet Onix LT", "Chevrolet", 60000, "carro", "populares"),
    ("VW Gol 1.0", "VW", 40000, "carro", "populares"),
    ("Gol 1.0 2018", "", 40000, "carro", "populares"),  # planilha sem marca
    ("Toyota Hilux SRX", "Toyota", 250000, "carro", "outros"),  # nacional, mas acima do teto
    ("Jeep Renegade", "Jeep", 78000, "carro", "outros"),
])
def test_faixa_do_anuncio(titulo, marca, preco, categoria, esperado):
    a = Anuncio("t", "1", titulo, preco, marca=marca)
    assert faixa_do_anuncio(a, categoria) == esperado


def test_teto_dos_populares_vem_da_config():
    a = Anuncio("t", "1", "Fiat Argo", 95000, marca="Fiat")
    assert faixa_do_anuncio(a, "carro") == "populares"  # teto padrão 110 mil
    assert faixa_do_anuncio(a, "carro", {"faixas": {"populares": {"preco_max": 90000}}}) == "outros"


def test_perfil_custos():
    assert perfil_custos("cavalo", "pesados") == "cavalo"
    assert perfil_custos("caminhao", "pesados") == "caminhao"
    assert perfil_custos("carro", "premium") == "premium"
    assert perfil_custos("carro", "populares") == "populares"
    assert perfil_custos("carro", "outros") == "populares"


def test_premium_usa_custos_proprios():
    fipe = ResultadoFipe(165000, "BMW 320i", "", "", 2019, 1.0)
    a = Anuncio("t", "1", "BMW 320i GP 2019", 130000, marca="BMW", ano=2019, km=112500)
    av = avaliar(a, "carro", fipe, None, 0, ano_atual=2026)
    assert av.faixa == "premium"
    assert av.preco_revenda == pytest.approx(165000 * 0.92)
    assert av.custos["preparação"] == 130000 * 0.03


def test_exemplo_gera_poucas_buscas_por_faixa():
    buscas = cfg_mod.buscas(cfg_mod.carregar(EXEMPLO_TOML))
    por_faixa = {f: [b for b in buscas if b.faixa == f] for f in ("pesados", "populares", "premium")}
    assert len(buscas) == sum(len(v) for v in por_faixa.values()) == 16
    assert {b.categoria for b in por_faixa["pesados"]} == {"cavalo", "caminhao"}
    onix = next(b for b in por_faixa["populares"] if b.modelo == "Onix")
    assert (onix.marca, onix.ufs, onix.preco_max) == ("Chevrolet", ["SP"], 90000)
    assert [b.marca for b in por_faixa["premium"]] == ["BMW", "Audi", "Mercedes-Benz"]


def test_faixa_desligada_e_modelos_premium():
    config = {"faixas": {
        "pesados": {"ativa": False},
        "premium": {"marcas": ["BMW", "Audi"], "modelos": {"BMW": ["320i", "X1"]}, "ufs": ["SP"]},
    }}
    nomes = [b.nome for b in buscas_das_faixas(config)]
    assert nomes == ["Premium · BMW 320i", "Premium · BMW X1", "Premium · Audi"]


def test_busca_de_modelo_nao_pega_parecido():
    b = Busca("x", marca="Volkswagen", modelo="Gol")
    assert b.aceita(Anuncio("t", "1", "VW GOL 1.0 MPI", 40000, marca="VW - VOLKSWAGEN"))
    assert not b.aceita(Anuncio("t", "2", "VW Golf 1.4 TSI", 80000, marca="VW - VOLKSWAGEN"))


def test_anuncio_de_outra_faixa_fica_de_fora():
    premium = Busca("Premium · Mercedes-Benz", faixa="premium", marca="Mercedes-Benz")
    assert da_faixa(Anuncio("t", "1", "Mercedes-Benz C 180", 110000, marca="Mercedes-Benz"), premium, {})
    assert not da_faixa(Anuncio("t", "2", "Mercedes-Benz Accelo 1016 baú", 180000, marca="Mercedes-Benz"),
                         premium, {})


def test_cli_faixas_e_limite_de_alertas(tmp_path, monkeypatch, capsys):
    import buscador_auto.__main__ as cli

    class FonteFalsa(Fonte):
        nome = "falsa"

        def buscar(self, busca):
            if busca.faixa == "premium":
                return [Anuncio("falsa", f"bmw{i}", "BMW 320i GP 2019", 120000 + i, marca="BMW", ano=2019,
                                km=60000, uf="SP", fipe_informada=165000) for i in range(5)]
            if busca.faixa == "pesados":
                return [Anuncio("falsa", "sc1", "Scania R 450 A 6x2 2019", 400000, marca="Scania", ano=2019,
                                uf="PR", fipe_informada=520000)]
            return []

    enviados = []
    monkeypatch.setattr(cli, "FONTES", {"falsa": FonteFalsa})
    monkeypatch.setattr(cli, "enviar_telegram", lambda token, chat, texto: enviados.append(texto) or True)
    (tmp_path / "buscas.toml").write_text(
        '[geral]\nsaida = "s"\nbanco = "d/h.db"\nscore_minimo_alerta = 50\nmax_alertas_por_faixa = 2\n'
        'pausa_entre_requisicoes = 0\n'
        '[telegram]\ntoken = "T"\nchat_id = "1"\n'
        '[faixas.pesados]\ntermos = ["cavalo mecânico"]\nfontes = ["falsa"]\n'
        '[faixas.populares]\nativa = false\n'
        '[faixas.premium]\nmarcas = ["BMW"]\nfontes = ["falsa"]\n',
        encoding="utf-8",
    )
    monkeypatch.chdir(tmp_path)
    assert main(["buscar", "--notificar", "--sem-fipe"]) == 0
    saida = capsys.readouterr().out
    assert "== PESADOS · 1 anúncio(s)" in saida and "== PREMIUM · 5 anúncio(s)" in saida
    assert "POPULARES" not in saida
    assert sum("Premium" in t for t in enviados) == 2  # limite por faixa
    assert sum("Pesados (Cavalo mecânico)" in t for t in enviados) == 1

    assert main(["buscar", "--faixa", "pesados", "--sem-fipe"]) == 0
    assert "PREMIUM" not in capsys.readouterr().out
