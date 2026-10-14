from buscador_auto.fipe import ClienteFipe, pontuar_marca, pontuar_modelo

from .conftest import SessaoFalsa


def test_pontuar_marca():
    assert pontuar_marca("Volkswagen", "VW - VolksWagen") > 0.9
    assert pontuar_marca("VW", "VW - VolksWagen") > 0.9
    assert pontuar_marca("GM", "GM - Chevrolet") > 0.9
    assert pontuar_marca("Chevrolet", "GM - Chevrolet") > 0.9
    assert pontuar_marca("Mercedes", "MERCEDES-BENZ") > 0.9
    assert pontuar_marca("Fiat", "GM - Chevrolet") == 0


def test_pontuar_modelo_prefere_versao_mais_simples():
    nomes = ["Gol 1.0 Mi Total Flex 8V 4p", "Gol Trend/ Power 1.0 Mi Total Flex 8V 4p",
             "Gol 1.6 Mi Total Flex 8V 4p", "Golf 1.4 TSI Highline"]
    notas = {n: pontuar_modelo("Gol 1.0", n) for n in nomes}
    assert max(notas, key=notas.get) == "Gol 1.0 Mi Total Flex 8V 4p"
    assert notas["Golf 1.4 TSI Highline"] < 0.3


def test_pontuar_modelo_tracao_e_potencia():
    nomes = ["R-440 A 6x2 2p (diesel)(E5)", "R-450 A 4x2 2p (diesel)(E5)",
             "R-450 A 6x2 2p (diesel)(E5)", "R-450 A 6x4 2p (diesel)(E5)"]
    notas = {n: pontuar_modelo("R450 6x2 cavalo", n) for n in nomes}
    assert max(notas, key=notas.get) == "R-450 A 6x2 2p (diesel)(E5)"


def test_buscar_cavalo(cliente_fipe):
    r = cliente_fipe.buscar("caminhoes", "Scania", "R 450 A 6x2", 2019)
    assert r is not None
    assert r.valor == 518432.0
    assert r.codigo == "509153-4"
    assert r.mes_referencia == "outubro de 2026"
    assert "R-450 A 6x2" in r.modelo
    assert r.confianca > 0.6


def test_buscar_sem_marca_acha_no_titulo(cliente_fipe):
    r = cliente_fipe.buscar("caminhoes", "", "", 2019, titulo="Scania R450 6x2 2019 único dono")
    assert r and r.valor == 518432.0


def test_buscar_cai_para_proximo_candidato_quando_falta_o_ano(cliente_fipe, sessao_fipe):
    r = cliente_fipe.buscar("carros", "VW", "Gol 1.0", 2018)
    assert r and r.valor == 45123.0
    assert "Gol (novo)" in r.modelo
    urls = [u for u, _ in sessao_fipe.pedidos]
    assert any(u.endswith("modelos/11/anos") for u in urls)  # tentou o melhor primeiro


def test_buscar_sem_ano_ou_marca_desconhecida(cliente_fipe):
    assert cliente_fipe.buscar("carros", "VW", "Gol 1.0", None) is None
    assert cliente_fipe.buscar("carros", "Lada", "Niva", 2018, titulo="Lada Niva") is None


def test_cache_em_disco_evita_nova_consulta(tmp_path, sessao_fipe):
    banco = tmp_path / "cache.db"
    ClienteFipe(cache=banco, sessao=sessao_fipe, pausa=0).buscar("caminhoes", "Scania", "R 450 A 6x2", 2019)
    feitos = len(sessao_fipe.pedidos)
    outra = SessaoFalsa({})
    r = ClienteFipe(cache=banco, sessao=outra, pausa=0).buscar("caminhoes", "Scania", "R 450 A 6x2", 2019)
    assert r and r.valor == 518432.0
    assert feitos > 0 and outra.pedidos == []


def test_api_v2():
    sessao = SessaoFalsa({
        "trucks/brands": [{"code": "122", "name": "SCANIA"}],
        "trucks/brands/122/models": [{"code": "3", "name": "R-450 A 6x2 2p (diesel)(E5)"}],
        "trucks/brands/122/models/3/years": [{"code": "2019-3", "name": "2019 Diesel"}],
        "trucks/brands/122/models/3/years/2019-3": {
            "price": "R$ 518.432,00", "model": "R-450 A 6x2 2p (diesel)(E5)", "codeFipe": "509153-4",
            "referenceMonth": "outubro de 2026", "modelYear": 2019,
        },
    })
    cliente = ClienteFipe(cache=None, versao=2, token="abc", sessao=sessao, pausa=0)
    r = cliente.buscar("caminhoes", "Scania", "R 450 A 6x2", 2019)
    assert r and r.valor == 518432.0
    assert sessao.headers["X-Subscription-Token"] == "abc"
    assert sessao.pedidos[0][0] == "https://fipe.parallelum.com.br/api/v2/trucks/brands"


def test_modelo_curto_usa_o_titulo():
    sessao = SessaoFalsa({
        "caminhoes/marcas": [{"nome": "VOLVO", "codigo": "124"}],
        "caminhoes/marcas/124/modelos": {"modelos": [
            {"nome": "FH-460 6x2 2p (diesel)(E5)", "codigo": 1},
            {"nome": "FH-540 6x4 2p (diesel)(E5)", "codigo": 2},
        ]},
        "caminhoes/marcas/124/modelos/2/anos": [{"nome": "2018 Diesel", "codigo": "2018-3"}],
        "caminhoes/marcas/124/modelos/2/anos/2018-3": {"Valor": "R$ 560.000,00", "Modelo": "FH-540 6x4"},
    })
    r = ClienteFipe(cache=None, sessao=sessao, pausa=0).buscar(
        "caminhoes", "Volvo", "FH", 2018, titulo="Volvo Fh 540 6x4 2018 revisado")
    assert r and r.valor == 560000.0
