#!/usr/bin/env python3
"""Cria o molde (template) da nova skill a partir de um exemplo preenchido.

Mantém só as linhas do bloco que se repete (normalmente a primeira página),
remove fotos, links externos e nomes definidos quebrados, apaga o conteúdo
das células variáveis e preserva estilos, mesclas, larguras, alturas e
configuração de impressão. O gerador da skill depois copia esse bloco quantas
vezes precisar.

Uso:
    python criar_molde.py exemplo_limpo.xlsx assets/modelo.xlsx \
        --manter 1-19 --limpar I3,I4,P4,F5,F6,M6,F7,M7,F8,B13,C13,E13,G13,H13,I13,Q13,R13

Rode antes o limpar_xlsx.py no exemplo, se ele tiver caixas de texto vazias.
"""

import argparse

from openpyxl import load_workbook


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("exemplo")
    ap.add_argument("destino")
    ap.add_argument("--manter", required=True, help="faixa de linhas do bloco-protótipo, ex.: 1-19")
    ap.add_argument("--limpar", default="", help="células variáveis a esvaziar, separadas por vírgula")
    ap.add_argument("--aba", help="aba a usar (padrão: a primeira); as outras são removidas")
    args = ap.parse_args()

    ini, _, fim = args.manter.partition("-")
    ini, fim = int(ini), int(fim or ini)

    wb = load_workbook(args.exemplo)
    ws = wb[args.aba] if args.aba else wb.worksheets[0]
    for outra in [w for w in wb.worksheets if w is not ws]:
        wb.remove(outra)
    ws._images = []
    wb._external_links = []
    for nome in list(wb.defined_names.keys()):
        del wb.defined_names[nome]
    for m in list(ws.merged_cells.ranges):
        if m.min_row > fim or m.max_row < ini:
            ws.unmerge_cells(m.coord)
    if ws.max_row > fim:
        ws.delete_rows(fim + 1, ws.max_row - fim)
    if ini > 1:
        ws.delete_rows(1, ini - 1)
    for coord in filter(None, (c.strip() for c in args.limpar.split(","))):
        ws[coord].value = None
    ws.row_breaks.brk = [b for b in ws.row_breaks.brk if ini <= b.id <= fim]
    ultima_col = ws.cell(1, ws.max_column).column_letter
    ws.print_area = f"A1:{ultima_col}{fim - ini + 1}"
    wb.save(args.destino)
    print(f"Molde salvo em {args.destino}: {ws.max_row} linhas, {len(ws.merged_cells.ranges)} mesclas")


if __name__ == "__main__":
    main()
