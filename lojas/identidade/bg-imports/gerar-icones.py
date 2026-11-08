"""Ícones do app da BG a partir do logo do dono: recorta o letreiro "BG IMPORTS" (sem a cena de fundo,
os produtos e as marcas de terceiros que aparecem nela) e o põe sobre o mesmo pôr do sol, desfocado.

Uso (na pasta lojas/): python3 identidade/bg-imports/gerar-icones.py identidade/bg-imports/logo-original.webp public/lojas/bg-imports
"""
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

origem, saida = sys.argv[1], sys.argv[2]
im = Image.open(origem).convert("RGB")
LETREIRO = (95, 85, 1185, 728)  # "BG" + "IMPORTS", sem o slogan
SO_BG = (574, 1150, 668, 1222)    # o "BG" pequeno do rodapé do logo, feito para tamanho pequeno


def fundo(t):
    f = im.resize((t, t), Image.LANCZOS).filter(ImageFilter.GaussianBlur(t / 28))
    return ImageEnhance.Brightness(f).enhance(0.8)


def colar(base, caixa, largura, centro):
    pedaco = im.crop(caixa)
    alt = round(pedaco.height * largura / pedaco.width)
    pedaco = pedaco.resize((largura, alt), Image.LANCZOS)
    # borda esfumada: o recorte se mistura ao fundo desfocado
    m = Image.new("L", pedaco.size, 0)
    r = max(2, largura // 30)
    ImageDraw.Draw(m).rounded_rectangle((r, r, pedaco.width - r, pedaco.height - r), radius=r * 2, fill=255)
    m = m.filter(ImageFilter.GaussianBlur(r * 0.8))
    base.paste(pedaco, (centro[0] - largura // 2, centro[1] - alt // 2), m)
    return base


def icone(t, frac, caixa=LETREIRO):
    return colar(fundo(t), caixa, round(t * frac), (t // 2, t // 2))


# grande primeiro e reduz: fica mais nítido
mestre = icone(1200, 0.94)
mestre.save(f"{saida}/logo-quadrado.png", optimize=True)
for nome, t in [("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180)]:
    mestre.resize((t, t), Image.LANCZOS).save(f"{saida}/{nome}", optimize=True)
# Android recorta em círculo: o letreiro fica dentro dos 80% do meio
icone(1200, 0.74).resize((512, 512), Image.LANCZOS).save(f"{saida}/icon-maskable-512.png", optimize=True)
# aba do navegador: só o "BG"
fav = Image.new("RGB", (256, 256), (16, 10, 24))
pequeno = im.crop(SO_BG)
pequeno = pequeno.resize((240, round(pequeno.height * 240 / pequeno.width)), Image.LANCZOS)
fav.paste(pequeno, (8, (256 - pequeno.height) // 2))
fav.resize((32, 32), Image.LANCZOS).save(f"{saida}/favicon-32.png", optimize=True)
print("ok")
