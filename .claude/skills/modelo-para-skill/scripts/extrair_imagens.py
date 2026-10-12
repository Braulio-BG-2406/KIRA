#!/usr/bin/env python3
"""Lista as imagens de um .xlsx com a aba e a linha onde estão ancoradas,
extrai os arquivos e gera uma folha de contato (contato.png) para olhar todas
de uma vez.

Serve para decidir quais imagens são pictogramas reutilizáveis (placas, EPIs,
cadeados) e quais são fotos específicas (pessoas, local da obra), que não devem
ir para a skill sem autorização.

Uso:
    python extrair_imagens.py arquivo.xlsx pasta_saida
"""

import io
import posixpath
import re
import sys
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw


def rels(z, caminho):
    pasta, nome = posixpath.split(caminho)
    r = posixpath.join(pasta, "_rels", nome + ".rels")
    if r not in z.namelist():
        return {}
    x = z.read(r).decode("utf-8")
    saida = {}
    for tag in re.findall(r"<Relationship\b[^>]*>", x):
        rid = re.search(r'Id="([^"]+)"', tag).group(1)
        alvo = re.search(r'Target="([^"]+)"', tag).group(1)
        saida[rid] = posixpath.normpath(posixpath.join(pasta, alvo))
    return saida


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    arquivo, saida = sys.argv[1], Path(sys.argv[2])
    saida.mkdir(parents=True, exist_ok=True)
    z = zipfile.ZipFile(arquivo)

    wbx = z.read("xl/workbook.xml").decode("utf-8")
    wb_rels = rels(z, "xl/workbook.xml")
    abas = [(re.search(r'name="([^"]+)"', t).group(1), re.search(r'r:id="([^"]+)"', t).group(1))
            for t in re.findall(r"<sheet\b[^>]*>", wbx)]

    itens = []
    for nome_aba, rid in abas:
        planilha = wb_rels[rid]
        for alvo in rels(z, planilha).values():
            if "/drawings/" not in alvo:
                continue
            x = z.read(alvo).decode("utf-8")
            mapa = rels(z, alvo)
            for bloco in re.findall(r"<xdr:(?:oneCellAnchor|twoCellAnchor)\b.*?</xdr:(?:oneCellAnchor|twoCellAnchor)>", x, re.S):
                emb = re.search(r'r:embed="([^"]+)"', bloco)
                if not emb:
                    continue
                col = int(re.search(r"<xdr:from><xdr:col>(\d+)</xdr:col>", bloco).group(1))
                lin = int(re.search(r"<xdr:from>.*?<xdr:row>(\d+)</xdr:row>", bloco, re.S).group(1))
                media = mapa[emb.group(1)]
                itens.append((nome_aba, lin + 1, col + 1, media))

    itens.sort()
    th = 200
    cols = 6
    folha = Image.new("RGB", (cols * th, max(1, -(-len(itens) // cols)) * (th + 24)), "white")
    d = ImageDraw.Draw(folha)
    for i, (aba, lin, col, media) in enumerate(itens):
        dados = z.read(media)
        nome = posixpath.basename(media)
        (saida / nome).write_bytes(dados)
        im = Image.open(io.BytesIO(dados))
        print(f"aba={aba!r} linha={lin} coluna={col} arquivo={nome} tamanho={im.size}")
        fundo = Image.new("RGB", im.size, "white")
        fundo.paste(im.convert("RGBA"), mask=im.convert("RGBA").split()[-1])
        fundo.thumbnail((th - 10, th - 10))
        x, y = (i % cols) * th, (i // cols) * (th + 24)
        folha.paste(fundo, (x + 5, y + 5))
        d.text((x + 5, y + th), f"L{lin} {nome}", fill="black")
    folha.save(saida / "contato.png")
    print(f"{len(itens)} imagens. Folha de contato: {saida / 'contato.png'}")


if __name__ == "__main__":
    main()
