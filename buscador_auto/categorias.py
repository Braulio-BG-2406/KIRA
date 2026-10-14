"""Separa carro, caminhão e cavalo mecânico pelo texto do anúncio."""

from __future__ import annotations

from .texto import contem, normalizar

CARRO = "carro"
CAMINHAO = "caminhao"
CAVALO = "cavalo"
CATEGORIAS = (CARRO, CAMINHAO, CAVALO)

NOMES = {CARRO: "Carro", CAMINHAO: "Caminhão", CAVALO: "Cavalo mecânico"}

# Tipo de veículo na tabela FIPE.
TIPO_FIPE = {CARRO: "carros", CAMINHAO: "caminhoes", CAVALO: "caminhoes"}

_MARCAS_SO_CAMINHAO = r"\b(scania|iveco|daf|agrale|international|sinotruk|sitrak|shacman|man tg[xsml])\b"

# Palavras de carroceria/configuração que só aparecem em anúncio de caminhão.
# ("caçamba", "carroceria" e "tanque" ficam de fora: aparecem em anúncio de picape e carro.)
_PALAVRAS_CAMINHAO = (
    r"\b(caminhao|caminhoes|cavalo mecanico|toco|truck|trucado|bitruck|bitruk|bi truck|"
    r"bau|graneleiro|graneleira|basculante|cacamba basculante|munck|munk|sider|prancha|"
    r"poliguindaste|boiadeiro|canavieiro|carroceria de madeira|carroceria aberta|"
    r"[468]x[24]\s*(cavalo|truck|toco|tracado))\b"
)

_MODELOS_CAMINHAO = (
    r"\b("
    # Volvo
    r"fh ?\d{3}|fmx? ?\d{3}|vm ?\d{3}|nh ?\d{2,3}|volvo (fh|fm|fmx|vm|nh|nl)|"
    # Mercedes-Benz
    r"actros|axor|atego|accelo|arocs|atron|ls ?1[69]\d{2}|ls ?2\d{3}|l ?1[1-9]\d{2}|"
    r"1113|1313|1513|1620|1634|1938|"
    # Volkswagen (8.160, 24.280, 25.420...), sem confundir com "85.000 km"
    r"constellation|delivery|worker|meteor|"
    r"(?:[89]|1\d|2\d|3[0-3])\.[1-4]\d0(?!\s*(?:km|mil|reais))|"
    # Ford
    r"ford cargo|cargo \d{3,4}|f ?4000|f ?12000|f ?14000|"
    # Iveco / DAF / MAN
    r"stralis|tector|iveco daily|hi ?way|s ?way|x ?way|daf xf|daf cf|xf ?\d{3}|tgx|tgs"
    r")\b"
)

_PALAVRAS_CAVALO = (
    r"\b(cavalo|cavalinho|quinta roda|5a roda|5 roda|trator rodoviario|"
    r"ls ?1[69]\d\d|ls ?2\d{3})\b"
)

# Modelos que quase sempre são vendidos como cavalo mecânico (só valem
# quando o texto já é de caminhão).
_MODELOS_CAVALO = (
    r"\b(fh ?\d{3}|volvo fh|actros 2\d{3}|axor 2[05]\d{2}|axor 2644|xf ?\d{3}|"
    r"[rgs] ?[4-7]\d{2}|tgx|stralis \d{3}|s ?way|hi ?way|"
    r"constellation (19|25)\.[34]\d{2}|19\.[34]\d{2}|25\.4\d{2})\b"
)

# Indícios de carro de passeio/utilitário que evitam falsos positivos.
_MODELOS_CARRO = (
    r"\b(xc ?\d{2}|v ?40|s ?60|c ?180|c ?200|c ?250|c ?300|gla|glc|cla|"
    r"gol|polo|virtus|nivus|t ?cross|taos|jetta|amarok|saveiro|voyage|fox|up|fusca|"
    r"hatch|sedan|suv|flex|cambio automatico)\b"
)


# Marcas que no Brasil só vendem carro/utilitário leve.
_MARCAS_SO_CARRO = (
    r"\b(bmw|audi|porsche|land rover|jaguar|mini cooper|jeep|honda|nissan|peugeot|citroen|kia|chery|byd|gwm)\b"
)


def detectar_categoria(texto: str, dica: str = "") -> str:
    """Devolve "carro", "caminhao" ou "cavalo".

    `dica` é a categoria da busca (ou da coluna da planilha); ela decide os
    casos ambíguos, mas não transforma um carro óbvio em caminhão.
    """
    t = normalizar(texto)
    dica = normalizar(dica)
    dica = {"caminhao": CAMINHAO, "cavalo": CAVALO, "cavalo mecanico": CAVALO, "carro": CARRO}.get(
        dica, ""
    )

    sinais_caminhao = (
        contem(t, _MARCAS_SO_CAMINHAO)
        or contem(t, _PALAVRAS_CAMINHAO)
        or (contem(t, _MODELOS_CAMINHAO) and not contem(t, _MODELOS_CARRO))
    )
    sinais_cavalo = contem(t, _PALAVRAS_CAVALO) or (
        sinais_caminhao and contem(t, _MODELOS_CAVALO)
    )

    if dica == CARRO and not contem(t, _PALAVRAS_CAMINHAO) and not contem(t, _MARCAS_SO_CAMINHAO):
        return CARRO
    # Carro evidente achado numa busca de caminhão continua sendo carro.
    if not sinais_caminhao and (contem(t, _MARCAS_SO_CARRO) or contem(t, _MODELOS_CARRO)):
        return CARRO
    if sinais_cavalo and (sinais_caminhao or dica in (CAMINHAO, CAVALO)):
        return CAVALO
    if sinais_caminhao or dica in (CAMINHAO, CAVALO):
        # Busca de cavalo sem sinal contrário (toco, baú...) fica como cavalo.
        if dica == CAVALO and not contem(t, r"\b(toco|bau|carroceria|graneleiro|cacamba|basculante|munck|sider)\b"):
            return CAVALO
        return CAMINHAO
    return CARRO
