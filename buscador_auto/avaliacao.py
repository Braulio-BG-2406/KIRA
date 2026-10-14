"""Avalia se um anúncio é oportunidade de revenda ou de compra para uso próprio."""

from __future__ import annotations

import datetime as dt
import logging
import re
import statistics
from collections import defaultdict

from .categorias import CARRO, TIPO_FIPE, detectar_categoria
from .modelos import Alerta, Anuncio, Avaliacao, ResultadoFipe
from .texto import normalizar, tokens

log = logging.getLogger(__name__)

# Valores de partida; ajuste em buscas.toml ([custos.carro], [custos.caminhao], [custos.cavalo]).
CUSTOS_PADRAO = {
    "carro": {
        "transferencia": 1200.0,  # Detran, vistoria de transferência, despachante
        "vistoria_cautelar": 350.0,
        "preparacao_pct": 0.02,  # estética, polimento, pequenos reparos
        "preparacao_min": 800.0,
        "comissao_pct": 0.0,  # comissão/anúncio pago na revenda
        "outros": 0.0,  # frete, deslocamento, IPVA proporcional...
        "fator_revenda": 0.97,  # por quanto se revende em relação à FIPE
        "km_ano": 15000,  # rodagem normal por ano
        "ajuste_km_10mil": 0.015,  # perda de valor a cada 10 mil km acima do normal
        "margem_min_pct": 0.10,
        "lucro_min": 4000.0,
        "desconto_uso_bom": 0.05,  # abaixo da FIPE para ser "boa compra" de uso
    },
    "caminhao": {
        "transferencia": 2500.0,
        "vistoria_cautelar": 800.0,
        "preparacao_pct": 0.03,
        "preparacao_min": 3000.0,
        "comissao_pct": 0.0,
        "outros": 0.0,
        "fator_revenda": 0.95,
        "km_ano": 70000,
        "ajuste_km_10mil": 0.003,
        "margem_min_pct": 0.10,
        "lucro_min": 15000.0,
        "desconto_uso_bom": 0.05,
    },
    "cavalo": {
        "transferencia": 2500.0,
        "vistoria_cautelar": 800.0,
        "preparacao_pct": 0.03,
        "preparacao_min": 5000.0,
        "comissao_pct": 0.0,
        "outros": 0.0,
        "fator_revenda": 0.95,
        "km_ano": 110000,
        "ajuste_km_10mil": 0.0025,
        "margem_min_pct": 0.10,
        "lucro_min": 20000.0,
        "desconto_uso_bom": 0.05,
    },
}

# (código, padrão no texto normalizado, gravidade, mensagem, perda na revenda)
ALERTAS_TEXTO = [
    ("sinistro", r"\b(sinistr|perda total|grande monta|media monta)", "alta",
     "Sinistro / monta registrada: revenda difícil e seguro caro", 0.30),
    ("leilao", r"\b(leilao|leiload|ex leilao|passagem por leilao)", "media",
     "Passagem por leilão: costuma valer 20-30% menos na revenda", 0.25),
    ("recuperado", r"\b(recuperad[oa] de (roubo|furto|financiamento)|roubo e furto)", "alta",
     "Recuperado de roubo/furto: desvaloriza e exige checar documentação", 0.20),
    ("enchente", r"\b(enchente|alagad|submers|boiou)", "alta",
     "Indício de enchente/alagamento", 0.35),
    ("remarcado", r"\b(remarcad|chassi adulterad|motor trocado sem nota)", "alta",
     "Chassi/motor remarcado", 0.35),
    ("documento", r"\b(sem doc|sem documento|doc(umento)? atrasad|nao transfer|baixa definitiva|"
     r"baixad[oa] no detran|documento em atraso|debitos? alto|multas? alta)", "alta",
     "Problema de documentação/débitos", 0.15),
    ("financiamento", r"\b(agio|assumir (as )?parcelas|assumir financiamento|passo financiamento|"
     r"transferencia de divida|repasse de financiamento|consorcio contemplado)", "alta",
     "Venda de ágio/financiamento: veículo alienado, alto risco", 0.30),
    ("pecas", r"\b(sucata|retirada de pecas|para pecas|so pecas|desmanche|sem motor)", "alta",
     "Vendido para peças/sucata", 0.60),
    ("mecanica", r"\b(motor fundido|motor batendo|precisa de motor|cambio quebrado|cambio com defeito|"
     r"motor (com )?defeito|retifica(r)? (o )?motor|funde|vazamento de oleo|fumacando)", "media",
     "Defeito mecânico declarado: orce o conserto antes", 0.15),
    ("batido", r"\b(batid[oa]|colisao|amassad[oa]s? grande|precisa de funilaria|lataria ruim)", "media",
     "Avaria de lataria/colisão declarada", 0.10),
]

SINAIS_POSITIVOS = [
    ("urgente", r"\b(urgente|preciso vender|motivo viagem|mudanca)"),
    ("aceita proposta", r"\b(aceito (proposta|oferta|troca)|aceita (proposta|oferta)|negociavel|estudo proposta)"),
    ("abaixo da FIPE", r"\b(abaixo da fipe|abaixo da tabela)"),
    ("repasse", r"\b(repasse|preco de repasse)"),
    ("único dono", r"\b(unico dono|1 dono|primeiro dono)"),
    ("revisado", r"\b(revisad|revisoes em dia|revisoes na concessionaria|manutencao em dia)"),
    ("cautelar aprovada", r"\b(cautelar aprovad|laudo aprovad|laudo cautelar ok)"),
    ("chave reserva/manual", r"\b(chave reserva|manual e chave)"),
    ("IPVA pago", r"\b(ipva (\d{4} )?pago|ipva quitado|documento ok|documentacao ok)"),
]


def custos_categoria(categoria: str, config: dict | None = None) -> dict:
    base = dict(CUSTOS_PADRAO.get(categoria, CUSTOS_PADRAO[CARRO]))
    base.update(((config or {}).get("custos") or {}).get(categoria, {}))
    return base


_NEGACAO = re.compile(r"\b(nunca|nao|sem|zero|nada de|livre de|jamais|nenhum|nenhuma|isento de)\b")


def _aparece_sem_negacao(padrao: str, texto: str) -> bool:
    """True se o padrão aparece ao menos uma vez sem "nunca/não/sem" logo antes
    (ex.: "nunca batido" e "sem passagem por leilão" não contam)."""
    for m in re.finditer(padrao, texto):
        antes = re.split(r"[.,;!?\n]", texto[max(0, m.start() - 30):m.start()])[-1]
        if not _NEGACAO.search(antes):
            return True
    return False


def detectar_alertas(anuncio: Anuncio) -> tuple[list[Alerta], list[str]]:
    texto = normalizar(anuncio.texto_completo)
    alertas = [
        Alerta(cod, msg, grav, perda)
        for cod, padrao, grav, msg, perda in ALERTAS_TEXTO
        if _aparece_sem_negacao(padrao, texto)
    ]
    if normalizar(anuncio.vendedor).startswith("leil") and not any(a.codigo == "leilao" for a in alertas):
        alertas.append(Alerta("leilao", "Veículo de leilão: costuma valer 20-30% menos na revenda", "media", 0.25))
    sinais = [nome for nome, padrao in SINAIS_POSITIVOS if _aparece_sem_negacao(padrao, texto)]
    return alertas, sinais


def calcular_custos(preco: float, cfg: dict) -> dict[str, float]:
    return {
        "transferência/documentação": cfg["transferencia"],
        "vistoria cautelar": cfg["vistoria_cautelar"],
        "preparação": max(cfg["preparacao_min"], preco * cfg["preparacao_pct"]),
        "comissão/anúncio": preco * cfg["comissao_pct"],
        "outros": cfg["outros"],
    }


def ajuste_por_km(km: int | None, ano: int | None, ano_atual: int, cfg: dict) -> float:
    """Fração a somar/subtrair do valor FIPE conforme a rodagem (entre -25% e +3%).

    Rodar acima do normal tira valor; rodar abaixo vale só metade disso como bônus,
    porque a FIPE já supõe um veículo em bom estado.
    """
    if km is None or not ano:
        return 0.0
    idade = max(0.5, ano_atual - ano + 0.5)
    excesso = (km - cfg["km_ano"] * idade) / 10000
    ajuste = -excesso * cfg["ajuste_km_10mil"] * (0.5 if excesso < 0 else 1)
    return max(-0.25, min(0.03, ajuste))


def chave_comparacao(anuncio: Anuncio, categoria: str, fipe: ResultadoFipe | None) -> tuple:
    """Agrupa anúncios do mesmo modelo e ano para calcular o preço de mercado."""
    if fipe and fipe.codigo:
        return (categoria, fipe.codigo, anuncio.ano)
    toks = [t for t in tokens(anuncio.modelo or anuncio.titulo) if not t.isdigit() or len(t) > 2]
    return (categoria, normalizar(anuncio.marca), " ".join(toks[:2]), anuncio.ano)


def avaliar(
    anuncio: Anuncio,
    categoria: str,
    fipe: ResultadoFipe | None,
    mediana: float | None,
    comparaveis: int,
    config: dict | None = None,
    ano_atual: int | None = None,
) -> Avaliacao:
    ano_atual = ano_atual or dt.date.today().year
    cfg = custos_categoria(categoria, config)
    alertas, sinais = detectar_alertas(anuncio)
    preco = anuncio.preco

    valor_fipe = fipe.valor if fipe else None
    ajuste = ajuste_por_km(anuncio.km, anuncio.ano, ano_atual, cfg)
    fipe_ajustada = valor_fipe * (1 + ajuste) if valor_fipe else None

    if fipe and fipe.confianca < 0.55:
        alertas.append(Alerta("fipe_incerta", f"FIPE aproximada ({fipe.modelo}); confira o modelo exato", "info"))
    if not valor_fipe:
        alertas.append(Alerta("sem_fipe", "Sem valor FIPE: informe marca/modelo/ano ou a FIPE na planilha", "info"))
    if anuncio.km is None:
        alertas.append(Alerta("sem_km", "Quilometragem não informada", "info"))
    # Compara com a FIPE já ajustada pela rodagem: caminhão muito rodado vale bem menos.
    if fipe_ajustada and preco < 0.55 * fipe_ajustada:
        alertas.append(Alerta("golpe", "Preço muito abaixo da FIPE: alto risco de golpe ou problema oculto", "alta"))
    elif fipe_ajustada and preco < 0.70 * fipe_ajustada:
        alertas.append(Alerta("preco_baixo", "Preço bem abaixo da FIPE: confirme procedência e estado", "media"))

    desconto_fipe = (fipe_ajustada - preco) / fipe_ajustada if fipe_ajustada else None
    desconto_mercado = (mediana - preco) / mediana if mediana else None

    # Preço de revenda: o menor entre FIPE ajustada x fator e o que o mercado pede.
    referencias = []
    if fipe_ajustada:
        referencias.append(fipe_ajustada * cfg["fator_revenda"])
    if mediana:
        referencias.append(mediana * 0.98)
    # Leilão, sinistro, defeito... tiram valor tanto na revenda quanto para quem vai usar.
    perda = max((a.desvalorizacao for a in alertas), default=0.0)
    preco_revenda = min(referencias) * (1 - perda) if referencias else None

    custos = calcular_custos(preco, cfg)
    custo_total = sum(custos.values())
    lucro = preco_revenda - preco - custo_total if preco_revenda else None
    margem = lucro / (preco + custo_total) if lucro is not None else None

    # Nota de 0 a 100: 50 = preço justo; cada 1% de desconto vale 1,5 ponto.
    descontos = [d for d in (desconto_fipe, desconto_mercado) if d is not None]
    if descontos:
        score = 50 + 150 * (sum(descontos) / len(descontos))
        if margem is not None:
            score += 40 * (margem - cfg["margem_min_pct"])
    else:
        score = 0
    for a in alertas:
        score -= {"alta": 30, "media": 12}.get(a.gravidade, 0)
    score += min(8, 2 * len(sinais))
    risco_alto = any(a.gravidade == "alta" for a in alertas)
    if risco_alto:
        score = min(score, 30)  # "barato demais" com risco alto nunca vai para o topo
    score = int(max(0, min(100, round(score))))

    if lucro is None:
        veredito_revenda = "SEM REFERÊNCIA"
    elif risco_alto:
        veredito_revenda = "RISCO"
    elif margem >= cfg["margem_min_pct"] * 1.5 and lucro >= cfg["lucro_min"] * 1.5:
        veredito_revenda = "ÓTIMA"
    elif margem >= cfg["margem_min_pct"] and lucro >= cfg["lucro_min"]:
        veredito_revenda = "BOA"
    elif lucro > 0:
        veredito_revenda = "MARGEM BAIXA"
    else:
        veredito_revenda = "SEM MARGEM"

    # Para uso próprio vale o menor desconto: abaixo da FIPE mas acima do que os
    # outros anunciantes pedem (comum em caminhão) não é boa compra.
    ref_uso = min(descontos) if descontos else None
    if ref_uso is not None and perda:
        ref_uso = 1 - (1 - ref_uso) / (1 - perda)  # desconto sobre o valor já descontado da perda
    if ref_uso is None:
        veredito_uso = "SEM REFERÊNCIA"
    elif risco_alto:
        veredito_uso = "RISCO"
    elif ref_uso >= cfg["desconto_uso_bom"] * 2.4 and not any(a.gravidade == "media" for a in alertas):
        veredito_uso = "ÓTIMA"
    elif ref_uso >= cfg["desconto_uso_bom"]:
        veredito_uso = "BOA"
    elif ref_uso >= -0.03:
        veredito_uso = "PREÇO JUSTO"
    else:
        veredito_uso = "CARA"

    return Avaliacao(
        anuncio=anuncio,
        categoria=categoria,
        fipe=fipe,
        fipe_ajustada=fipe_ajustada,
        ajuste_km_pct=ajuste,
        mediana_mercado=mediana,
        comparaveis=comparaveis,
        preco_revenda=preco_revenda,
        custos=custos,
        custo_total=custo_total,
        lucro=lucro,
        margem_pct=margem,
        desconto_fipe_pct=desconto_fipe,
        desconto_mercado_pct=desconto_mercado,
        alertas=alertas,
        sinais=sinais,
        score=score,
        veredito_revenda=veredito_revenda,
        veredito_uso=veredito_uso,
    )


def consultar_fipe(anuncio: Anuncio, categoria: str, cliente, ano_atual: int) -> ResultadoFipe | None:
    if anuncio.fipe_informada:
        return ResultadoFipe(anuncio.fipe_informada, "informada na planilha", "", "", anuncio.ano or 0, 1.0)
    if cliente is None:
        return None
    try:
        return cliente.buscar(
            TIPO_FIPE[categoria],
            anuncio.marca,
            " ".join(p for p in (anuncio.modelo, anuncio.versao) if p),
            anuncio.ano,
            combustivel=anuncio.combustivel,
            ano_atual=ano_atual,
            titulo=anuncio.titulo,
        )
    except Exception as erro:  # rede fora, limite da API etc.: segue sem FIPE
        log.warning("FIPE indisponível para %s: %s", anuncio.titulo, erro)
        return None


def avaliar_lote(
    anuncios: list[Anuncio],
    cliente_fipe=None,
    config: dict | None = None,
    ano_atual: int | None = None,
    min_comparaveis: int = 2,
) -> list[Avaliacao]:
    """Avalia vários anúncios: FIPE de cada um + mediana dos parecidos no lote."""
    ano_atual = ano_atual or dt.date.today().year
    preparados = []
    fipe_cache: dict[tuple, ResultadoFipe | None] = {}
    for a in anuncios:
        if not a.preco or a.preco <= 0:
            continue
        categoria = detectar_categoria(a.texto_completo, a.categoria)
        chave = (categoria, normalizar(a.marca), normalizar(a.modelo), normalizar(a.versao),
                 a.ano, normalizar(a.titulo), a.fipe_informada)
        if chave not in fipe_cache:
            fipe_cache[chave] = consultar_fipe(a, categoria, cliente_fipe, ano_atual)
        preparados.append((a, categoria, fipe_cache[chave]))

    grupos: dict[tuple, list[int]] = defaultdict(list)
    for i, (a, categoria, fipe) in enumerate(preparados):
        grupos[chave_comparacao(a, categoria, fipe)].append(i)

    resultado = []
    for i, (a, categoria, fipe) in enumerate(preparados):
        # Mediana dos OUTROS anúncios do mesmo modelo/ano (o próprio não entra).
        outros = [preparados[j][0].preco for j in grupos[chave_comparacao(a, categoria, fipe)] if j != i]
        mediana = statistics.median(outros) if len(outros) >= min_comparaveis else None
        resultado.append(avaliar(a, categoria, fipe, mediana, len(outros), config, ano_atual))
    resultado.sort(key=lambda r: (-r.score, -(r.lucro or -1e12)))
    return resultado
