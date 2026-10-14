"""Linha de comando do buscador de oportunidades automotivas.

Exemplos:
    python -m buscador_auto buscar -c buscas.toml --notificar
    python -m buscador_auto importar leilao.csv
    python -m buscador_auto avaliar --titulo "Scania R 450 A 6x2" --ano 2019 --km 480000 --preco 420000
    python -m buscador_auto fipe --categoria cavalo --marca Scania --modelo "R 450 A 6x2" --ano 2019
"""

from __future__ import annotations

import argparse
import datetime as dt
import logging
import sys
from pathlib import Path

from . import config as cfg_mod
from .avaliacao import avaliar_lote
from .categorias import NOMES, TIPO_FIPE, detectar_categoria
from .coleta import coletar, montar_fontes
from .faixas import FAIXAS, OUTROS
from .fipe import ClienteFipe
from .fontes import FONTES, ler_planilha
from .historico import Historico
from .modelos import Anuncio
from .notificacao import enviar_telegram, mensagem
from .relatorio import detalhe_terminal, salvar_csv, salvar_html, tabela_terminal
from .texto import formatar_reais, ler_ano, ler_numero

log = logging.getLogger("buscador_auto")


def _cliente_fipe(config: dict, args) -> ClienteFipe | None:
    if getattr(args, "sem_fipe", False):
        return None
    f = config["fipe"]
    return ClienteFipe(cache=f.get("cache"), versao=int(f.get("versao", 1)), token=f.get("token") or None)


def _processar(anuncios: list[Anuncio], config: dict, args, titulo: str, aviso: str = "") -> int:
    geral = config["geral"]
    avaliacoes = avaliar_lote(anuncios, _cliente_fipe(config, args), config)
    if not avaliacoes:
        print("Nenhum anúncio para avaliar.")
        return 1
    historico = Historico(geral["banco"])
    historico.registrar(avaliacoes)

    print(tabela_terminal(avaliacoes, int(geral.get("limite_por_faixa", 5))))
    saida = Path(geral["saida"])
    carimbo = dt.datetime.now().strftime("%Y%m%d-%H%M")
    html = salvar_html(avaliacoes, saida / "ultimo.html", titulo, aviso)
    salvar_html(avaliacoes, saida / f"oportunidades-{carimbo}.html", titulo, aviso)
    csv_ = salvar_csv(avaliacoes, saida / f"oportunidades-{carimbo}.csv")
    print(f"\nRelatório: {html.resolve()}\nPlanilha:  {csv_.resolve()}")

    if getattr(args, "notificar", False):
        tg = config["telegram"]
        if not (tg["token"] and tg["chat_id"]):
            print("Telegram não configurado (TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID).", file=sys.stderr)
        else:
            escolhidas = historico.para_notificar(avaliacoes, int(geral["score_minimo_alerta"]))
            limite = int(geral.get("max_alertas_por_faixa", 3))
            por_faixa: dict[str, int] = {}
            enviadas = 0
            for av in escolhidas:  # já vêm da maior para a menor nota
                faixa = av.faixa or OUTROS
                if por_faixa.get(faixa, 0) >= limite:
                    continue
                por_faixa[faixa] = por_faixa.get(faixa, 0) + 1
                if enviar_telegram(tg["token"], tg["chat_id"], mensagem(av)):
                    historico.marcar_notificado(av)
                    enviadas += 1
            print(f"Telegram: {enviadas} aviso(s) enviado(s), até {limite} por faixa, nota mínima "
                  f"{geral['score_minimo_alerta']}.")
    return 0


def cmd_buscar(args) -> int:
    config = cfg_mod.carregar(args.config)
    buscas = cfg_mod.buscas(config)
    if args.faixa:
        buscas = [b for b in buscas if b.faixa == args.faixa]
    if args.so:
        buscas = [b for b in buscas if args.so.lower() in b.nome.lower()]
    if not buscas:
        print("Nenhuma busca configurada. Copie buscas.exemplo.toml para buscas.toml e ajuste.", file=sys.stderr)
        return 2
    fontes = montar_fontes(config, FONTES)
    vistos: dict[str, Anuncio] = {}
    for busca in buscas:
        aceitos, resumo = coletar(busca, fontes, config)
        for a in aceitos:
            vistos.setdefault(a.chave, a)
        for r in resumo:
            if "erro" in r:
                print(f"[{busca.nome}] {r['fonte']}: falhou ({r['erro']})")
            else:
                print(f"[{busca.nome}] {r['fonte']}: {r['achados']} anúncios, {r['aceitos']} dentro dos filtros")
    return _processar(list(vistos.values()), config, args, "Oportunidades automotivas")


def cmd_importar(args) -> int:
    config = cfg_mod.carregar(args.config)
    anuncios = ler_planilha(args.arquivo)
    for a in anuncios:
        a.categoria = a.categoria or (args.categoria or "")
        a.busca = a.busca or Path(args.arquivo).name
    print(f"{len(anuncios)} anúncios lidos de {args.arquivo}")
    return _processar(anuncios, config, args, f"Oportunidades · {Path(args.arquivo).name}", args.aviso or "")


def _anuncio_dos_args(args) -> Anuncio:
    titulo = args.titulo or " ".join(p for p in (args.marca, args.modelo, args.versao) if p)
    return Anuncio(
        fonte="manual",
        id="manual",
        titulo=titulo,
        preco=ler_numero(args.preco) or 0.0,
        marca=args.marca or "",
        modelo=args.modelo or ("" if args.marca else titulo),
        versao=args.versao or "",
        ano=args.ano or ler_ano(titulo, dt.date.today().year),
        km=int(ler_numero(args.km)) if args.km else None,
        uf=args.uf or "",
        descricao=args.descricao or "",
        categoria=args.categoria or "",
        vendedor=args.vendedor or "",
        fipe_informada=ler_numero(args.fipe) if args.fipe else None,
    )


def cmd_avaliar(args) -> int:
    config = cfg_mod.carregar(args.config)
    anuncio = _anuncio_dos_args(args)
    if not anuncio.preco:
        print("Informe --preco.", file=sys.stderr)
        return 2
    av = avaliar_lote([anuncio], _cliente_fipe(config, args), config)[0]
    print(detalhe_terminal(av))
    return 0


def cmd_fipe(args) -> int:
    config = cfg_mod.carregar(args.config)
    texto = " ".join(p for p in (args.marca, args.modelo) if p)
    categoria = args.categoria or detectar_categoria(texto)
    cliente = _cliente_fipe(config, args)
    if cliente is None:
        print("O comando fipe precisa consultar a FIPE; rode sem --sem-fipe.", file=sys.stderr)
        return 2
    r = cliente.buscar(TIPO_FIPE[categoria], args.marca or "", args.modelo, args.ano,
                       ano_atual=dt.date.today().year, titulo=texto)
    if not r:
        print("Não encontrei esse veículo na FIPE. Tente escrever o modelo como na tabela (ex.: \"R 450 A 6x2\").")
        return 1
    print(f"{NOMES[categoria]}: {r.modelo} {r.ano_modelo}\nFIPE {r.codigo}: {formatar_reais(r.valor)} "
          f"({r.mes_referencia}) · confiança da correspondência {r.confianca:.0%}")
    return 0


def cmd_servir(args) -> int:
    from .web import servir
    servir(args.porta, args.host)
    return 0


def cmd_gerar_site(args) -> int:
    from .web import gerar_pagina
    print(f"Página gerada: {gerar_pagina()}")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="buscador_auto", description="Buscador de oportunidades: carro, caminhão e cavalo mecânico.")
    p.add_argument("-v", "--verboso", action="store_true", help="mostra detalhes de cada consulta")
    sub = p.add_subparsers(dest="comando", required=True)

    def comum(sp, config_obrigatorio=False):
        sp.add_argument("-c", "--config", default="buscas.toml" if config_obrigatorio else None,
                        help="arquivo de configuração (TOML)")
        sp.add_argument("--sem-fipe", action="store_true", help="não consulta a FIPE (usa só a planilha/mercado)")

    b = sub.add_parser("buscar", help="procura anúncios nas fontes configuradas")
    comum(b, config_obrigatorio=True)
    b.add_argument("--faixa", choices=FAIXAS, help="roda só uma faixa: pesados, populares ou premium")
    b.add_argument("--so", help="roda só as buscas cujo nome contém este texto (ex.: Onix, BMW)")
    b.add_argument("--notificar", action="store_true", help="envia as melhores para o Telegram")
    b.set_defaults(func=cmd_buscar)

    i = sub.add_parser("importar", help="avalia anúncios de uma planilha CSV/XLSX (leilões, Marketplace...)")
    comum(i)
    i.add_argument("arquivo")
    i.add_argument("--categoria", choices=list(NOMES), help="categoria padrão das linhas sem categoria")
    i.add_argument("--notificar", action="store_true")
    i.add_argument("--aviso", help="texto de aviso exibido no topo do relatório")
    i.set_defaults(func=cmd_importar)

    a = sub.add_parser("avaliar", help="avalia um único anúncio")
    comum(a)
    a.add_argument("--preco", required=True)
    a.add_argument("--titulo")
    a.add_argument("--marca")
    a.add_argument("--modelo")
    a.add_argument("--versao")
    a.add_argument("--ano", type=int)
    a.add_argument("--km")
    a.add_argument("--uf")
    a.add_argument("--fipe", help="valor FIPE, se já souber (dispensa a consulta)")
    a.add_argument("--categoria", choices=list(NOMES))
    a.add_argument("--vendedor", help="particular, loja, leilao...")
    a.add_argument("--descricao", help="texto do anúncio, para detectar alertas")
    a.set_defaults(func=cmd_avaliar)

    f = sub.add_parser("fipe", help="consulta o valor FIPE de um veículo")
    comum(f)
    f.add_argument("--categoria", choices=list(NOMES))
    f.add_argument("--marca", required=True)
    f.add_argument("--modelo", required=True)
    f.add_argument("--ano", type=int, required=True)
    f.set_defaults(func=cmd_fipe)

    sv = sub.add_parser("servir", help="abre o site do buscador no navegador (http://127.0.0.1:8000)")
    sv.add_argument("--porta", type=int, default=8000)
    sv.add_argument("--host", default="127.0.0.1", help="use 0.0.0.0 para acessar de outro aparelho")
    sv.set_defaults(func=cmd_servir)

    g = sub.add_parser("gerar-site", help="atualiza public/index.html a partir do modelo do relatório")
    g.set_defaults(func=cmd_gerar_site)

    args = p.parse_args(argv)
    logging.basicConfig(level=logging.INFO if args.verboso else logging.WARNING, format="%(levelname)s %(message)s")
    if getattr(args, "config", "") is None and Path("buscas.toml").exists():
        args.config = "buscas.toml"  # usa os custos personalizados, se houver
    if args.comando == "buscar" and not Path(args.config).exists():
        print(f"Arquivo {args.config} não existe. Copie buscas.exemplo.toml para buscas.toml.", file=sys.stderr)
        return 2
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
