#!/usr/bin/env python3
"""Remove caixas de texto vazias de um .xlsx (lixo comum de copiar/colar).

Planilhas que passaram anos sendo copiadas costumam acumular milhares de caixas
de texto invisíveis: o arquivo fica pesado, demora para abrir e trava o
LibreOffice. Só são removidas caixas de texto SEM texto; fotos, formas com
texto e o resto do arquivo ficam intactos.

Uso:
    python limpar_xlsx.py entrada.xlsx saida.xlsx
"""

import re
import sys
import zipfile

ANCORA = re.compile(r"<xdr:(oneCellAnchor|twoCellAnchor|absoluteAnchor)\b.*?</xdr:\1>", re.S)


def eh_caixa_vazia(bloco: str) -> bool:
    return 'txBox="1"' in bloco and "<a:t>" not in bloco and "<xdr:pic>" not in bloco


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    origem, destino = sys.argv[1], sys.argv[2]
    total_removidas = 0
    with zipfile.ZipFile(origem) as zin, zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            dados = zin.read(item.filename)
            if re.match(r"xl/drawings/drawing\d+\.xml$", item.filename):
                texto = dados.decode("utf-8")
                antes = len(ANCORA.findall(texto))
                texto = ANCORA.sub(lambda m: "" if eh_caixa_vazia(m.group(0)) else m.group(0), texto)
                depois = len(ANCORA.findall(texto))
                total_removidas += antes - depois
                print(f"{item.filename}: {antes} objetos -> {depois} (removidas {antes - depois} caixas vazias)")
                dados = texto.encode("utf-8")
            zout.writestr(item, dados)
    print(f"Total removido: {total_removidas}. Salvo em {destino}")


if __name__ == "__main__":
    main()
