import pytest

from buscador_auto.categorias import detectar_categoria
from buscador_auto.texto import formatar_reais, ler_ano, ler_km, ler_numero, ler_uf, tokens


@pytest.mark.parametrize("texto, esperado", [
    ("R$ 45.900,00", 45900.0),
    ("R$ 45.900", 45900.0),
    ("1.234.567", 1234567.0),
    ("45900", 45900.0),
    ("45,9 mil", 45900.0),
    (380000, 380000.0),
    ("", None),
    ("a combinar", None),
])
def test_ler_numero(texto, esperado):
    assert ler_numero(texto) == esperado


def test_ler_km():
    assert ler_km("80.000 km") == 80000
    assert ler_km("520 mil km") == 520000


@pytest.mark.parametrize("texto, esperado", [
    ("2015/2016", 2016),
    ("15/16", 2016),
    ("Gol 1.0 2018", 2018),
    ("Axor 2041 2012", 2012),  # 2041 é modelo, não ano
    ("Ford Cargo 2042 2020", 2020),
    ("Mercedes 1938 LS", None),
    (2019, 2019),
])
def test_ler_ano(texto, esperado):
    assert ler_ano(texto, 2026) == esperado


@pytest.mark.parametrize("texto, esperado", [
    ("SP", "SP"), ("BR-PR", "PR"), ("São Paulo", "SP"), ("São Paulo (SP)", "SP"),
    ("Campinas - SP", "SP"), ("Minas Gerais", "MG"), ("", ""),
])
def test_ler_uf(texto, esperado):
    assert ler_uf(texto) == esperado


def test_tokens_igualam_grafias():
    assert tokens("R-450 A 6x2") == tokens("R450 a 6 x 2") == ["r", "450", "a", "6x2"]
    assert tokens("Gol 1,0 8V 4p") == ["gol", "1.0", "8v", "4p"]
    assert tokens("CONSTELLATION 24.280 (E5)") == ["constellation", "24.280", "e5"]


def test_formatar_reais():
    assert formatar_reais(45900) == "R$ 45.900"
    assert formatar_reais(-1500) == "-R$ 1.500"
    assert formatar_reais(None) == "-"


@pytest.mark.parametrize("texto, dica, esperado", [
    ("Chevrolet Onix LT 1.0 2020 rádio FM, carroceria sem amassados", "", "carro"),
    ("Toyota Hilux SRV 2.8 diesel com capota na caçamba", "", "carro"),
    ("Volvo XC60 T5 2018", "", "carro"),
    ("Mercedes-Benz C 180 2016", "", "carro"),
    ("Gol 1.0 rodado 85.000 km", "", "carro"),
    ("Volkswagen Constellation 24.280 6x2 baú", "", "caminhao"),
    ("Mercedes-Benz Atego 2426 graneleiro", "", "caminhao"),
    ("Ford Cargo 1119 toco", "", "caminhao"),
    ("Volvo VM 270 6x2", "", "caminhao"),
    ("Scania P 310 bitruck basculante", "", "caminhao"),
    ("Scania R 450 A 6x2 2019", "", "cavalo"),
    ("Volvo FH 540 6x4", "", "cavalo"),
    ("Mercedes-Benz Actros 2651 6x4", "", "cavalo"),
    ("DAF XF 480 FTT", "", "cavalo"),
    ("Mercedes LS 1938 com quinta roda", "", "cavalo"),
    ("Iveco Tector 240E28 cavalo mecânico", "", "cavalo"),
    ("Volvo 2015 6x2", "cavalo", "cavalo"),
    ("Volvo 2015 6x2 baú", "cavalo", "caminhao"),
    ("Scania R 450", "carro", "cavalo"),  # dica errada não transforma caminhão em carro
])
def test_detectar_categoria(texto, dica, esperado):
    assert detectar_categoria(texto, dica) == esperado
