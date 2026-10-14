from .base import Busca, Fonte, criar_sessao
from .mercadolivre import MercadoLivre
from .olx import OLX
from .planilha import ler_planilha
from .webmotors import Webmotors

FONTES = {f.nome: f for f in (OLX, MercadoLivre, Webmotors)}

__all__ = ["Busca", "Fonte", "FONTES", "OLX", "MercadoLivre", "Webmotors", "criar_sessao", "ler_planilha"]
