"""Estruturas de dados do buscador."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Anuncio:
    fonte: str
    id: str
    titulo: str
    preco: float
    url: str = ""
    marca: str = ""
    modelo: str = ""
    versao: str = ""
    ano: int | None = None
    km: int | None = None
    cidade: str = ""
    uf: str = ""
    descricao: str = ""
    categoria: str = ""  # carro, caminhao ou cavalo; vazio = detectar
    vendedor: str = ""  # particular, loja, leilao...
    combustivel: str = ""
    fipe_informada: float | None = None  # valor FIPE digitado na planilha
    imagem: str = ""
    busca: str = ""

    @property
    def chave(self) -> str:
        return f"{self.fonte}:{self.id}"

    @property
    def nome_veiculo(self) -> str:
        partes = [self.marca, self.modelo, self.versao]
        return " ".join(p for p in partes if p).strip() or self.titulo

    @property
    def texto_completo(self) -> str:
        return " ".join(
            p for p in (self.titulo, self.marca, self.modelo, self.versao, self.descricao) if p
        )


@dataclass
class ResultadoFipe:
    valor: float
    modelo: str
    codigo: str
    mes_referencia: str
    ano_modelo: int
    confianca: float  # 0 a 1: quanto o nome do anúncio bate com o modelo FIPE


@dataclass
class Alerta:
    codigo: str
    mensagem: str
    gravidade: str  # alta, media ou info
    desvalorizacao: float = 0.0  # perda no preço de revenda (0,25 = 25%)


@dataclass
class Avaliacao:
    anuncio: Anuncio
    categoria: str
    fipe: ResultadoFipe | None
    fipe_ajustada: float | None
    ajuste_km_pct: float
    mediana_mercado: float | None
    comparaveis: int
    preco_revenda: float | None
    custos: dict[str, float]
    custo_total: float
    lucro: float | None
    margem_pct: float | None
    desconto_fipe_pct: float | None
    desconto_mercado_pct: float | None
    alertas: list[Alerta]
    sinais: list[str]
    score: int
    veredito_revenda: str
    veredito_uso: str
    novo: bool = True
    queda_preco: float = 0.0
    extras: dict = field(default_factory=dict)

    @property
    def risco_alto(self) -> bool:
        return any(a.gravidade == "alta" for a in self.alertas)
