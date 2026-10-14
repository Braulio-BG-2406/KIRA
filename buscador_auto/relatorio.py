"""Saídas: tabela no terminal, CSV e página HTML com filtros."""

from __future__ import annotations

import csv
import datetime as dt
import html as html_lib
import json
from pathlib import Path

from .categorias import NOMES
from .modelos import Avaliacao
from .texto import formatar_pct, formatar_reais

MODELO_HTML = Path(__file__).with_name("modelo_relatorio.html")


def para_dict(av: Avaliacao) -> dict:
    a = av.anuncio
    return {
        "chave": a.chave,
        "fonte": a.fonte,
        "busca": a.busca,
        "titulo": a.titulo,
        "veiculo": a.nome_veiculo,
        "url": a.url,
        "imagem": a.imagem,
        "categoria": av.categoria,
        "categoria_nome": NOMES.get(av.categoria, av.categoria),
        "preco": a.preco,
        "ano": a.ano,
        "km": a.km,
        "cidade": a.cidade,
        "uf": a.uf,
        "vendedor": a.vendedor,
        "fipe": av.fipe.valor if av.fipe else None,
        "fipe_modelo": av.fipe.modelo if av.fipe else "",
        "fipe_codigo": av.fipe.codigo if av.fipe else "",
        "fipe_mes": av.fipe.mes_referencia if av.fipe else "",
        "fipe_confianca": av.fipe.confianca if av.fipe else None,
        "fipe_ajustada": av.fipe_ajustada,
        "ajuste_km": av.ajuste_km_pct,
        "mediana_mercado": av.mediana_mercado,
        "comparaveis": av.comparaveis,
        "preco_revenda": av.preco_revenda,
        "custos": av.custos,
        "custo_total": av.custo_total,
        "lucro": av.lucro,
        "margem": av.margem_pct,
        "desconto_fipe": av.desconto_fipe_pct,
        "desconto_mercado": av.desconto_mercado_pct,
        "alertas": [{"msg": x.mensagem, "grav": x.gravidade} for x in av.alertas],
        "sinais": av.sinais,
        "score": av.score,
        "revenda": av.veredito_revenda,
        "uso": av.veredito_uso,
        "novo": av.novo,
        "queda": av.queda_preco,
    }


def tabela_terminal(avaliacoes: list[Avaliacao], limite: int = 20) -> str:
    if not avaliacoes:
        return "Nenhum anúncio avaliado."
    cab = f"{'Nota':>4}  {'Revenda':<14} {'Uso':<14} {'Preço':>13} {'FIPE aj.':>13} {'Abaixo':>7} {'Lucro':>13}  Veículo"
    linhas = [cab, "-" * len(cab)]
    for av in avaliacoes[:limite]:
        a = av.anuncio
        risco = " ⚠" if av.risco_alto else ""
        linhas.append(
            f"{av.score:>4}  {av.veredito_revenda:<14} {av.veredito_uso:<14} {formatar_reais(a.preco):>13} "
            f"{formatar_reais(av.fipe_ajustada):>13} {formatar_pct(av.desconto_fipe_pct):>7} "
            f"{formatar_reais(av.lucro):>13}  {a.titulo[:60]} ({a.ano or '?'}, {a.fonte}){risco}"
        )
    if len(avaliacoes) > limite:
        linhas.append(f"... e mais {len(avaliacoes) - limite} no relatório HTML/CSV")
    return "\n".join(linhas)


def detalhe_terminal(av: Avaliacao) -> str:
    a = av.anuncio
    km = f"{a.km:,} km".replace(",", ".") if a.km is not None else "km não informado"
    linhas = [
        f"{a.titulo}",
        f"  Categoria: {NOMES.get(av.categoria, av.categoria)} · Ano {a.ano or '?'} · {km}",
        f"  Preço pedido:        {formatar_reais(a.preco)}",
    ]
    if av.fipe:
        linhas.append(f"  FIPE:                {formatar_reais(av.fipe.valor)}  ({av.fipe.modelo}"
                      f"{', ' + av.fipe.mes_referencia if av.fipe.mes_referencia else ''})")
        linhas.append(f"  Ajuste por km:       {formatar_pct(av.ajuste_km_pct)} → FIPE ajustada {formatar_reais(av.fipe_ajustada)}")
        linhas.append(f"  Desconto s/ FIPE:    {formatar_pct(av.desconto_fipe_pct)}")
    if av.mediana_mercado:
        linhas.append(f"  Mediana do mercado:  {formatar_reais(av.mediana_mercado)} ({av.comparaveis} anúncios) "
                      f"→ desconto {formatar_pct(av.desconto_mercado_pct)}")
    linhas.append("  Custos para revender:")
    for nome, valor in av.custos.items():
        if valor:
            linhas.append(f"    - {nome:<26} {formatar_reais(valor)}")
    linhas += [
        f"  Revenda estimada:    {formatar_reais(av.preco_revenda)}",
        f"  Lucro estimado:      {formatar_reais(av.lucro)}  (margem {formatar_pct(av.margem_pct)})",
        f"  Veredito revenda:    {av.veredito_revenda}",
        f"  Veredito uso próprio: {av.veredito_uso}",
        f"  Nota:                {av.score}/100",
    ]
    for alerta in av.alertas:
        linhas.append(f"  [{alerta.gravidade.upper()}] {alerta.mensagem}")
    if av.sinais:
        linhas.append(f"  Sinais positivos: {', '.join(av.sinais)}")
    return "\n".join(linhas)


def salvar_csv(avaliacoes: list[Avaliacao], caminho: str | Path) -> Path:
    caminho = Path(caminho)
    caminho.parent.mkdir(parents=True, exist_ok=True)
    campos = ["score", "revenda", "uso", "categoria_nome", "titulo", "preco", "ano", "km", "cidade", "uf",
              "fipe", "fipe_ajustada", "desconto_fipe", "mediana_mercado", "desconto_mercado",
              "preco_revenda", "custo_total", "lucro", "margem", "alertas", "sinais", "fonte", "url"]
    with caminho.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=campos, delimiter=";", extrasaction="ignore")
        w.writeheader()
        for av in avaliacoes:
            d = para_dict(av)
            d["alertas"] = " | ".join(x["msg"] for x in d["alertas"])
            d["sinais"] = ", ".join(d["sinais"])
            for k in ("preco", "fipe", "fipe_ajustada", "mediana_mercado", "preco_revenda", "custo_total", "lucro"):
                if d[k] is not None:
                    d[k] = f"{d[k]:.2f}".replace(".", ",")
            for k in ("desconto_fipe", "desconto_mercado", "margem"):
                if d[k] is not None:
                    d[k] = f"{d[k] * 100:.1f}".replace(".", ",")
            w.writerow(d)
    return caminho


def salvar_html(avaliacoes: list[Avaliacao], caminho: str | Path, titulo: str = "Oportunidades automotivas",
                aviso: str = "") -> Path:
    caminho = Path(caminho)
    caminho.parent.mkdir(parents=True, exist_ok=True)
    dados = json.dumps([para_dict(av) for av in avaliacoes], ensure_ascii=False).replace("</", "<\\/")
    gerado = dt.datetime.now().strftime("%d/%m/%Y %H:%M")
    html = (MODELO_HTML.read_text(encoding="utf-8")
            .replace("{{TITULO}}", html_lib.escape(titulo))
            .replace("{{GERADO}}", gerado)
            .replace("{{AVISO}}", html_lib.escape(aviso))
            .replace("{{DADOS}}", dados))
    caminho.write_text(html, encoding="utf-8")
    return caminho
