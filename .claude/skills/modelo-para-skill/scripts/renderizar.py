#!/usr/bin/env python3
"""Converte um documento (.xlsx, .docx ou .pdf) em imagens das páginas, para
conferir o visual. Com --comparar, coloca as páginas de dois documentos lado a
lado (ex.: o exemplo original e o gerado pela nova skill).

Precisa do LibreOffice (soffice) para .xlsx/.docx e do pdftoppm (poppler).

Uso:
    python renderizar.py arquivo.xlsx --saida pasta [--dpi 60] [--paginas 1-3]
    python renderizar.py gerado.xlsx --comparar original.xlsx --saida pasta

Saídas: pasta/<nome>-N.png por página, pasta/grade.png (visão geral) e, com
--comparar, pasta/lado-a-lado-N.png. Para ver detalhes (texto cortado, datas),
use --dpi 120 e uma página só.
"""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image


def para_pdf(arquivo: Path, pasta: Path) -> Path:
    if arquivo.suffix.lower() == ".pdf":
        return arquivo
    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    if not soffice:
        sys.exit("LibreOffice não encontrado (soffice).")
    subprocess.run([soffice, "--headless", "--convert-to", "pdf", "--outdir", str(pasta), str(arquivo)],
                   check=True, capture_output=True, timeout=600)
    pdf = pasta / (arquivo.stem + ".pdf")
    if not pdf.exists():
        sys.exit(f"Falha ao converter {arquivo}")
    return pdf


def para_png(pdf: Path, pasta: Path, prefixo: str, dpi: int, paginas: str | None) -> list[Path]:
    if not shutil.which("pdftoppm"):
        sys.exit("pdftoppm não encontrado (pacote poppler-utils).")
    for antigo in pasta.glob(f"{prefixo}-*.png"):  # páginas de uma rodada anterior
        antigo.unlink()
    cmd = ["pdftoppm", "-r", str(dpi), "-png"]
    if paginas:
        a, _, b = paginas.partition("-")
        cmd += ["-f", a, "-l", b or a]
    subprocess.run(cmd + [str(pdf), str(pasta / prefixo)], check=True)
    return sorted(pasta.glob(f"{prefixo}-*.png"), key=lambda p: int(p.stem.rsplit("-", 1)[1]))


def grade(imagens: list[Path], destino: Path, colunas: int = 3):
    if not imagens:
        return
    ims = [Image.open(p) for p in imagens]
    w, h = ims[0].size
    linhas = -(-len(ims) // colunas)
    folha = Image.new("RGB", (w * colunas, h * linhas), "white")
    for i, im in enumerate(ims):
        folha.paste(im, ((i % colunas) * w, (i // colunas) * h))
    folha.save(destino)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("arquivo")
    ap.add_argument("--saida", required=True)
    ap.add_argument("--dpi", type=int, default=60)
    ap.add_argument("--paginas", help="ex.: 1-3")
    ap.add_argument("--comparar", help="segundo documento para pôr lado a lado")
    args = ap.parse_args()

    pasta = Path(args.saida)
    pasta.mkdir(parents=True, exist_ok=True)
    a = para_png(para_pdf(Path(args.arquivo), pasta), pasta, "a", args.dpi, args.paginas)
    grade(a, pasta / "grade.png")
    print(f"{len(a)} páginas -> {pasta / 'grade.png'}")

    if args.comparar:
        b = para_png(para_pdf(Path(args.comparar), pasta), pasta, "b", args.dpi, args.paginas)
        grade(b, pasta / "grade-comparar.png")
        for i, (pa, pb) in enumerate(zip(a, b), start=1):
            ia, ib = Image.open(pa), Image.open(pb)
            lado = Image.new("RGB", (ia.width + ib.width, max(ia.height, ib.height)), "white")
            lado.paste(ia, (0, 0))
            lado.paste(ib, (ia.width, 0))
            lado.save(pasta / f"lado-a-lado-{i}.png")
        print(f"{len(b)} páginas no segundo documento; pares em {pasta}/lado-a-lado-N.png "
              f"(esquerda = {Path(args.arquivo).name}, direita = {Path(args.comparar).name})")


if __name__ == "__main__":
    main()
