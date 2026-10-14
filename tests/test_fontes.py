import json

from buscador_auto.fontes import OLX, Busca, MercadoLivre, Webmotors, ler_planilha
from buscador_auto.fontes import mercadolivre, olx, webmotors
from buscador_auto.modelos import Anuncio

from .conftest import SessaoFalsa

NEXT_DATA = {
    "props": {"pageProps": {"ads": [
        {"subject": "SCANIA R 450 A 6X2 2019", "price": "R$ 455.000", "listId": 1234,
         "url": "https://pr.olx.com.br/regiao-de-maringa/autos-e-pecas/caminhoes/scania-1234",
         "professionalAd": False, "thumbnail": "https://img/1.jpg",
         "locationDetails": {"municipality": "Maringá", "uf": "PR"},
         "properties": [
             {"name": "vehicle_brand", "label": "Marca", "value": "SCANIA"},
             {"name": "vehicle_model", "label": "Modelo", "value": "R 450 A 6X2"},
             {"name": "regdate", "label": "Ano", "value": "2019"},
             {"name": "mileage", "label": "Quilometragem", "value": "520000"},
         ]},
        {"advertisingId": "banner"},
        {"subject": "Onix LT 2020", "price": "R$ 59.900", "listId": 99, "url": "https://sp.olx.com.br/x",
         "professionalAd": True, "location": "Campinas, SP",
         "properties": [{"label": "Ano", "value": "2020"}, {"label": "Quilometragem", "value": "62.000"}]},
    ]}}
}
HTML_OLX = f'<html><script id="__NEXT_DATA__" type="application/json">{json.dumps(NEXT_DATA)}</script></html>'


def test_olx_ler_pagina():
    ads = olx.ler_pagina(HTML_OLX, "cavalo", ano_atual=2026)
    assert len(ads) == 2
    a = ads[0]
    assert (a.fonte, a.id, a.preco, a.marca, a.modelo, a.ano, a.km) == (
        "olx", "1234", 455000.0, "SCANIA", "R 450 A 6X2", 2019, 520000)
    assert (a.cidade, a.uf, a.vendedor, a.categoria) == ("Maringá", "PR", "particular", "cavalo")
    b = ads[1]
    assert (b.cidade, b.uf, b.ano, b.km, b.vendedor) == ("Campinas", "SP", 2020, 62000, "loja")


def test_olx_pagina_bloqueada():
    assert olx.ler_pagina("<html>Attention Required</html>") == []


def test_olx_urls_e_paginacao():
    sessao = SessaoFalsa({"/caminhoes/estado-pr": HTML_OLX})
    sessao.get = _get_html(sessao)
    busca = Busca("cavalos", categoria="cavalo", preco_max=500000, ufs=["PR"], paginas=2)
    ads = OLX(sessao, pausa=0).buscar(busca)
    assert len(ads) == 4
    url, params = sessao.pedidos[0]
    assert url == "https://www.olx.com.br/autos-e-pecas/caminhoes/estado-pr"
    assert params == {"q": "cavalo mecanico", "pe": 500000}
    assert sessao.pedidos[1][1]["o"] == 2


def _get_html(sessao):
    original = sessao.get

    def get(url, timeout=None, params=None):
        r = original(url, timeout, params)
        r.text = r.dado
        return r
    return get


ML = {
    "paging": {"total": 1},
    "results": [{
        "id": "MLB123", "title": "Volvo Fh 540 6x4 2018", "price": 455000, "permalink": "https://ml/MLB123",
        "attributes": [
            {"id": "BRAND", "value_name": "Volvo"}, {"id": "MODEL", "value_name": "FH"},
            {"id": "TRIM", "value_name": "540 6x4"}, {"id": "VEHICLE_YEAR", "value_name": "2018"},
            {"id": "KILOMETERS", "value_name": "700000 km"},
        ],
        "location": {"city": {"name": "Rondonópolis"}, "state": {"id": "BR-MT", "name": "Mato Grosso"}},
    }],
}


def test_mercadolivre_ler_resultados():
    a = mercadolivre.ler_resultados(ML, "cavalo", ano_atual=2026)[0]
    assert (a.id, a.preco, a.marca, a.modelo, a.versao, a.ano, a.km, a.cidade, a.uf) == (
        "MLB123", 455000.0, "Volvo", "FH", "540 6x4", 2018, 700000, "Rondonópolis", "MT")


def test_mercadolivre_parametros_e_token():
    sessao = SessaoFalsa({"/sites/MLB/search": ML})
    fonte = MercadoLivre(sessao, pausa=0, token="tok")
    ads = fonte.buscar(Busca("c", categoria="cavalo", preco_min=100000, preco_max=500000, paginas=3))
    assert len(ads) == 1 and len(sessao.pedidos) == 1  # parou: total = 1
    params = sessao.pedidos[0][1]
    assert params["category"] == "MLB1743" and params["q"] == "cavalo mecânico"
    assert params["price"] == "100000-500000"
    assert sessao.headers["Authorization"] == "Bearer tok"


WM = {"SearchResults": [{
    "UniqueId": 555,
    "Specification": {"Title": "CHEVROLET ONIX 1.0 LT", "Make": {"Value": "CHEVROLET"}, "Model": {"Value": "ONIX"},
                      "Version": {"Value": "1.0 FLEX LT MANUAL"}, "YearFabrication": "2019", "YearModel": 2020.0,
                      "Odometer": 62000.0, "NumberPorts": "4"},
    "Seller": {"SellerType": "PJ", "City": "São Paulo", "State": "São Paulo (SP)"},
    "Prices": {"Price": 68500.0},
}]}


def test_webmotors_ler_resultados():
    a = webmotors.ler_resultados(WM, ano_atual=2026)[0]
    assert (a.id, a.preco, a.marca, a.ano, a.km, a.uf, a.vendedor) == (
        "555", 68500.0, "CHEVROLET", 2020, 62000, "SP", "loja")
    assert a.url.endswith("/chevrolet/onix/1-0-flex-lt-manual/4-portas/2019-2020/555")


def test_webmotors_ignora_caminhao_e_monta_url():
    fonte = Webmotors(SessaoFalsa({}), pausa=0)
    assert fonte.buscar(Busca("x", categoria="cavalo")) == []
    url = fonte.url_estoque(Busca("x", marca="Chevrolet", modelo="Onix", ano_min=2018, preco_max=70000, ufs=["SP"]))
    assert url.startswith("https://www.webmotors.com.br/carros/estoque/chevrolet/onix?")
    assert "anode=2018" in url and "precoate=70000" in url and "estadocidade=SP" in url


def test_busca_aceita():
    b = Busca("x", ano_min=2018, preco_max=70000, km_max=100000, ufs=["SP"], modelo="Onix")
    ok = Anuncio("t", "1", "Onix LT", 60000, ano=2019, km=50000, uf="SP")
    assert b.aceita(ok)
    for mudanca in ({"preco": 80000}, {"ano": 2016}, {"km": 150000}, {"uf": "RJ"}, {"titulo": "HB20"}):
        assert not b.aceita(Anuncio(**{**ok.__dict__, **mudanca}))


def test_planilha_csv_ponto_e_virgula(tmp_path):
    arq = tmp_path / "leilao.csv"
    arq.write_text(
        "Lote;Veículo;Lance;Ano/Modelo;KM;Estado;Valor FIPE;Observações\n"
        "112;DAF XF 480 FTT 6x4;R$ 430.000,00;2020/2021;350.000;São Paulo;600.000;Vendido no estado\n"
        ";linha sem preço;;;;;;\n",
        encoding="utf-8",
    )
    ads = ler_planilha(arq, ano_atual=2026)
    assert len(ads) == 1
    a = ads[0]
    assert (a.id, a.titulo, a.preco, a.ano, a.km, a.uf, a.fipe_informada, a.fonte) == (
        "112", "DAF XF 480 FTT 6x4", 430000.0, 2021, 350000, "SP", 600000.0, "leilao")


def test_planilha_xlsx(tmp_path):
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.append(["titulo", "preco", "ano", "km", "fipe"])
    ws.append(["Toyota Corolla XEi 2.0", 72000, 2017, 110000, 92000])
    wb.save(tmp_path / "lista.xlsx")
    a = ler_planilha(tmp_path / "lista.xlsx", ano_atual=2026)[0]
    assert (a.preco, a.ano, a.km, a.fipe_informada) == (72000.0, 2017, 110000, 92000.0)


def test_busca_aceita_apelido_de_marca():
    assert Busca("x", marca="VW").aceita(Anuncio("t", "1", "Gol 1.0", 40000, marca="Volkswagen"))
    assert Busca("x", marca="Mercedes").aceita(Anuncio("t", "1", "Actros 2651", 600000, marca="MERCEDES-BENZ"))
    assert not Busca("x", marca="VW").aceita(Anuncio("t", "1", "Onix", 60000, marca="Chevrolet"))
