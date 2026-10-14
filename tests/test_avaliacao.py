from buscador_auto.avaliacao import ajuste_por_km, avaliar, avaliar_lote, custos_perfil, detectar_alertas
from buscador_auto.modelos import Anuncio, ResultadoFipe


def anuncio(**kw):
    base = dict(fonte="t", id=kw.pop("id", "1"), titulo="Chevrolet Onix LT 1.0 2020", preco=60000,
                marca="Chevrolet", modelo="Onix", versao="LT 1.0", ano=2020, km=80000)
    base.update(kw)
    return Anuncio(**base)


def fipe(valor):
    return ResultadoFipe(valor, "GM - Chevrolet Onix", "004001-1", "outubro de 2026", 2020, 0.9)


def codigos(av):
    return {a.codigo for a in av.alertas}


def test_negacao_nao_gera_alerta():
    alertas, _ = detectar_alertas(anuncio(descricao="Nunca batido, sem leilão, não é de enchente."))
    assert alertas == []


def test_alertas_e_sinais():
    alertas, sinais = detectar_alertas(anuncio(descricao="Ex-leilão, motor fundido. Urgente, aceito proposta."))
    assert {a.codigo for a in alertas} == {"leilao", "mecanica"}
    assert "urgente" in sinais and "aceita proposta" in sinais


def test_vendedor_leilao_vira_alerta():
    alertas, _ = detectar_alertas(anuncio(vendedor="Leilão"))
    assert [a.codigo for a in alertas] == ["leilao"]


def test_ajuste_por_km():
    cfg = custos_perfil("populares")
    assert ajuste_por_km(None, 2020, 2026, cfg) == 0
    assert ajuste_por_km(97500, 2020, 2026, cfg) == 0  # exatamente o esperado (6,5 anos x 15 mil)
    assert ajuste_por_km(197500, 2020, 2026, cfg) == -0.15
    assert ajuste_por_km(5000, 2020, 2026, cfg) == 0.03  # bônus limitado
    assert ajuste_por_km(5_000_000, 2020, 2026, cfg) == -0.25


def test_oportunidade_de_revenda():
    av = avaliar(anuncio(preco=52000, km=97500), "carro", fipe(72000), None, 0, ano_atual=2026)
    assert av.fipe_ajustada == 72000
    assert av.preco_revenda == 72000 * 0.97
    assert av.custo_total == 1200 + 350 + 1040
    assert av.lucro == 72000 * 0.97 - 52000 - 2590
    assert av.veredito_revenda == "ÓTIMA"
    assert av.veredito_uso == "ÓTIMA"
    assert av.score >= 85


def test_preco_de_mercado_limita_revenda():
    av = avaliar(anuncio(preco=60000, km=97500), "carro", fipe(72000), 64000, 5, ano_atual=2026)
    assert av.preco_revenda == 64000 * 0.98
    assert av.veredito_revenda in ("MARGEM BAIXA", "SEM MARGEM")


def test_golpe_nunca_fica_no_topo():
    av = avaliar(anuncio(preco=20000), "carro", fipe(72000), None, 0, ano_atual=2026)
    assert "golpe" in codigos(av)
    assert av.veredito_revenda == "RISCO" and av.veredito_uso == "RISCO"
    assert av.score <= 30


def test_leilao_tira_valor_da_revenda_e_do_uso():
    limpo = avaliar(anuncio(preco=58000, km=97500), "carro", fipe(72000), None, 0, ano_atual=2026)
    leilao = avaliar(anuncio(preco=58000, km=97500, vendedor="leilao"), "carro", fipe(72000), None, 0, ano_atual=2026)
    assert leilao.preco_revenda == limpo.preco_revenda * 0.75
    assert limpo.veredito_uso == "ÓTIMA"  # 19% abaixo da FIPE
    assert leilao.veredito_uso == "CARA"


def test_sem_fipe_e_sem_mercado():
    av = avaliar(anuncio(), "carro", None, None, 0, ano_atual=2026)
    assert av.veredito_revenda == "SEM REFERÊNCIA"
    assert av.score == 0
    assert "sem_fipe" in codigos(av)


def test_custos_personalizados():
    config = {"custos": {"cavalo": {"transferencia": 4000, "preparacao_min": 0, "preparacao_pct": 0}}}
    av = avaliar(anuncio(titulo="Scania R 450", preco=400000, km=None), "cavalo", fipe(520000), None, 0,
                 config, ano_atual=2026)
    assert av.custos["transferência/documentação"] == 4000
    assert av.custo_total == 4000 + 800


def test_lote_mediana_exclui_o_proprio_e_ordena(cliente_fipe):
    anuncios = [anuncio(id=str(i), preco=p, fipe_informada=72000) for i, p in enumerate([58000, 68000, 70000, 71000])]
    avs = avaliar_lote(anuncios, None, ano_atual=2026)
    assert avs[0].anuncio.preco == 58000
    assert avs[0].mediana_mercado == 70000  # mediana de 68, 70 e 71 mil
    assert avs[0].comparaveis == 3


def test_lote_consulta_fipe_uma_vez_por_modelo(cliente_fipe, sessao_fipe):
    anuncios = [Anuncio("t", str(i), "Scania R 450 A 6x2 2019", 450000 + i * 1000, marca="Scania",
                        modelo="R 450 A 6x2", ano=2019, km=500000) for i in range(3)]
    avs = avaliar_lote(anuncios, cliente_fipe, ano_atual=2026)
    assert all(av.categoria == "cavalo" and av.fipe.valor == 518432.0 for av in avs)
    precos = [u for u, _ in sessao_fipe.pedidos if u.endswith("/anos/2019-3")]
    assert len(precos) == 1


def test_lote_ignora_sem_preco_e_sobrevive_a_fipe_fora():
    class FipeQuebrada:
        def buscar(self, *a, **k):
            raise ConnectionError("sem rede")
    avs = avaliar_lote([anuncio(preco=0), anuncio(id="2")], FipeQuebrada(), ano_atual=2026)
    assert len(avs) == 1 and avs[0].fipe is None


def test_uso_proprio_considera_o_mercado():
    # 7% abaixo da FIPE, mas 12% acima do que os outros anunciantes pedem
    av = avaliar(anuncio(titulo="Scania R 450", preco=495000, km=None), "cavalo", fipe(535000), 440000, 2,
                 ano_atual=2026)
    assert av.desconto_fipe_pct > 0.05
    assert av.veredito_uso == "CARA"
