#!/usr/bin/env python3
"""Monta uma prévia estática das lojas a partir do servidor de produção rodando localmente.

Percorre a vitrine de cada loja (início, categorias e produtos), tira o JavaScript do Next,
troca os links por arquivos locais, embute as fontes latinas num site.css único e acrescenta
uma faixa de prévia, um menu simples e avisos para o que fica desligado (sacola, busca,
WhatsApp). O resultado é publicado como Artifact (index.html + files).

Uso:
  python3 montar_previa.py --saida /caminho/site --loja bg-imports --loja infinite
    [--servidor http://127.0.0.1:3100] [--projeto /home/user/KIRA/lojas]
    [--aviso "catálogo de exemplo"]

A primeira --loja vira index.html (página principal); as outras, <slug>.html.
Ao final grava files.json: o mapa para o parâmetro `files` do Artifact.
"""
import argparse
import base64
import html
import json
import os
import re
import sys
import urllib.request
from collections import deque

ap = argparse.ArgumentParser()
ap.add_argument("--saida", required=True)
ap.add_argument("--loja", action="append", required=True, help="slug da loja; a primeira é a principal")
ap.add_argument("--servidor", default="http://127.0.0.1:3100")
ap.add_argument("--projeto", default="/home/user/KIRA/lojas")
ap.add_argument("--aviso", default="catálogo de exemplo")
args = ap.parse_args()

SLUGS = args.loja
os.makedirs(args.saida, exist_ok=True)


def baixar(caminho):
    with urllib.request.urlopen(args.servidor + caminho, timeout=60) as r:
        return r.read().decode("utf-8")


def principal(slug):
    return "index.html" if slug == SLUGS[0] else f"{slug}.html"


def arquivo_de(caminho):
    """/loja/<slug>[/categoria|produto/<x>] -> nome do arquivo da prévia, ou None"""
    m = re.fullmatch(r"/loja/([a-z0-9-]+)(?:/(categoria|produto)/([a-z0-9-]+))?/?", caminho)
    if not m or m.group(1) not in SLUGS:
        return None
    return principal(m.group(1)) if not m.group(2) else f"{m.group(1)}-{m.group(2)}-{m.group(3)}.html"


def texto(h):
    return html.unescape(re.sub(r"<[^>]+>", "", h)).strip()


# 1) páginas: percorre os links internos a partir da vitrine de cada loja
paginas = {}
fila = deque(f"/loja/{s}" for s in SLUGS)
while fila:
    c = fila.popleft()
    if c in paginas:
        continue
    paginas[c] = baixar(c)
    for href in re.findall(r'href="(/loja/[^"#?]*)', paginas[c]):
        alvo = href.rstrip("/")
        if arquivo_de(alvo) and alvo not in paginas:
            fila.append(alvo)

# nome e tema de cada loja, lidos da própria página
info = {}
for s in SLUGS:
    h = paginas[f"/loja/{s}"]
    titulo = texto(re.search(r"<title>(.*?)</title>", h, re.S).group(1))
    tema = re.search(r'data-tema="([a-z-]+)"', h)
    info[s] = {"nome": titulo.split("|")[0].strip(), "tema": tema.group(1) if tema else ""}

# 2) CSS único com as fontes latinas embutidas
m = re.search(r'href="(/_next/static/css/[^"]+\.css)"', paginas[f"/loja/{SLUGS[0]}"])
if not m:
    sys.exit("Não achei o CSS do site: o servidor está rodando o build de produção?")
css = open(args.projeto + "/.next" + m.group(1).replace("/_next", "", 1), encoding="utf-8").read()


def fonte(bloco):
    url = re.search(r"url\((/_next/static/media/[^)]+)\)", bloco.group(0))
    if not url or re.search(r"cyrillic|vietnamese|greek", url.group(1)):
        return ""
    dados = open(args.projeto + "/.next" + url.group(1).replace("/_next", "", 1), "rb").read()
    b64 = base64.b64encode(dados).decode()
    return re.sub(r"src:[^;}]*", f'src:url(data:font/woff2;base64,{b64}) format("woff2")', bloco.group(0))


css = re.sub(r"@font-face\{[^}]*\}", fonte, css)
css += """
:root{color-scheme:light;--previa-fundo:#141414;--previa-texto:#f4f1ec;--previa-ouro:#c9a86a}
html body{font-family:inherit;font-size:1rem;line-height:inherit;background:#fff;color:#1c1917}
.previa-barra{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:4px 18px;background:var(--previa-fundo);color:var(--previa-texto);font:400 12px/1.5 system-ui,sans-serif;letter-spacing:.04em;padding-block:8px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));text-align:center}
.previa-barra a{color:var(--previa-ouro);text-decoration:underline;text-underline-offset:3px}
.previa-aviso{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:100;max-width:calc(100% - 32px);background:var(--previa-fundo);color:var(--previa-texto);font:400 14px/1.45 system-ui,sans-serif;padding:12px 18px;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.25)}
.previa-menu{position:fixed;inset:0;z-index:90;background:#fff;color:#1c1917;overflow:auto;font-family:"Jost Variable",system-ui,sans-serif;padding-block:calc(24px + env(safe-area-inset-top,0px)) 32px;padding-left:max(24px,env(safe-area-inset-left,0px));padding-right:max(24px,env(safe-area-inset-right,0px))}
.previa-menu button{font:inherit;font-size:14px;letter-spacing:.06em;background:none;border:0;cursor:pointer;color:inherit}
.previa-menu ul{list-style:none;margin:48px auto 0;padding:0;max-width:640px;display:grid;gap:14px}
.previa-menu li a{font-size:clamp(26px,6vw,40px);font-weight:300;color:inherit;text-decoration:none}
.previa-menu.serifa li a{font-family:"Playfair Display Variable",Georgia,serif;font-weight:400}
.previa-menu li a:hover,.previa-menu li a:focus-visible{text-decoration:underline;text-underline-offset:6px}
"""
open(os.path.join(args.saida, "site.css"), "w", encoding="utf-8").write(css)

# categorias de cada loja, para o menu
categorias = {s: [] for s in SLUGS}
for c, h in paginas.items():
    mm = re.fullmatch(r"/loja/([a-z0-9-]+)/categoria/[a-z0-9-]+", c)
    if mm:
        t = re.search(r"<h1[^>]*>(.*?)</h1>", h, re.S)
        categorias[mm.group(1)].append((texto(t.group(1)) if t else c.rsplit("/", 1)[1], arquivo_de(c)))

SCRIPT = r"""
<script>
(function () {
  var aviso;
  function avisar(texto) {
    if (!aviso) { aviso = document.createElement("div"); aviso.className = "previa-aviso"; aviso.setAttribute("role", "status"); document.body.appendChild(aviso); }
    aviso.textContent = texto; aviso.hidden = false;
    clearTimeout(avisar.t); avisar.t = setTimeout(function () { aviso.hidden = true; }, 3200);
  }
  var menu = document.getElementById("previa-menu");
  document.addEventListener("click", function (e) {
    var el = e.target.closest("a,button");
    if (!el) return;
    var tipo = el.getAttribute("data-previa");
    var texto = (el.getAttribute("aria-label") || el.textContent || "").trim().toLowerCase();
    if (tipo === "whatsapp") { e.preventDefault(); avisar("No site publicado, este botão abre o WhatsApp da loja."); return; }
    if (tipo === "off") { e.preventDefault(); avisar("Na prévia, sacola, busca e acompanhamento de pedido ficam desligados."); return; }
    if (el.tagName === "BUTTON" && texto === "menu" && menu) { menu.hidden = false; menu.querySelector("button").focus(); return; }
    if (el.id === "previa-fechar") { menu.hidden = true; return; }
    if (el.tagName === "BUTTON" && /sacola|carrinho|comprar|pagar/.test(texto)) { avisar("Na prévia, a compra fica desligada. No site publicado, a peça vai para a sacola."); }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && menu) menu.hidden = true; });
})();
</script>
"""


def transformar(caminho, h):
    slug = caminho.split("/")[2]
    titulo = texto(re.search(r"<title>(.*?)</title>", h, re.S).group(1))
    corpo = re.search(r"<body([^>]*)>(.*)</body>", h, re.S)
    classes = re.search(r'class="([^"]*)"', corpo.group(1))
    c = corpo.group(2)
    c = re.sub(r"<script\b[^>]*>.*?</script>", "", c, flags=re.S)
    c = re.sub(r'<link[^>]*as="script"[^>]*/?>', "", c)
    c = re.sub(r'<form([^>]*?)\saction="[^"]*"', r"<form\1", c)

    def link(mh):
        alvo = html.unescape(mh.group(1))
        if alvo.startswith(("https://wa.me/", "https://api.whatsapp.com/")):
            return 'href="#" data-previa="whatsapp"'
        if alvo.startswith("/"):
            caminho_alvo, _, ancora = alvo.partition("#")
            arq = arquivo_de(caminho_alvo.split("?")[0].rstrip("/") or "/")
            if arq:
                return f'href="{arq}{"#" + ancora if ancora else ""}"'
            return 'href="#" data-previa="off"'
        return mh.group(0)

    c = re.sub(r'href="([^"]*)"', link, c)
    outras = " ".join(f'<a href="{principal(s)}">Ver a {html.escape(info[s]["nome"])}</a>' for s in SLUGS if s != slug)
    aviso = f" · {html.escape(args.aviso)}" if args.aviso else ""
    barra = f'<div class="previa-barra"><span>Prévia do site da {html.escape(info[slug]["nome"])}{aviso} · compra desligada</span>{outras}</div>'
    itens = "".join(f'<li><a href="{a}">{html.escape(n)}</a></li>' for n, a in categorias[slug])
    serifa = " serifa" if info[slug]["tema"] == "elegante" else ""
    menu = (f'<div id="previa-menu" class="previa-menu{serifa}" role="dialog" aria-label="Menu" hidden>'
            f'<button type="button" id="previa-fechar">Fechar ✕</button><ul><li><a href="{principal(slug)}">Início</a></li>{itens}</ul></div>')
    return titulo, f'<div class="{classes.group(1) if classes else ""}">{barra}{c}{menu}</div>{SCRIPT}'


arquivos = []
for caminho, h in paginas.items():
    titulo, conteudo = transformar(caminho, h)
    arq = arquivo_de(caminho)
    if arq == "index.html":
        # página principal: o Artifact põe o esqueleto (doctype, head, body) em volta
        doc = f'<title>{html.escape(info[SLUGS[0]]["nome"])}</title>\n<link rel="stylesheet" href="site.css">\n{conteudo}\n'
    else:
        doc = ('<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8">'
               '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
               f'<title>{html.escape(titulo)}</title><link rel="stylesheet" href="site.css">'
               '<style>body{margin:0}</style></head>'
               f'<body>{conteudo}</body></html>\n')
        arquivos.append(arq)
    open(os.path.join(args.saida, arq), "w", encoding="utf-8").write(doc)

arquivos.append("site.css")
mapa = {a: a for a in sorted(arquivos)}
json.dump(mapa, open(os.path.join(args.saida, "files.json"), "w", encoding="utf-8"), indent=1)
restos = [a for a in os.listdir(args.saida) if a.endswith(".html") and "_next" in open(os.path.join(args.saida, a), encoding="utf-8").read()]
print(f"{len(paginas)} páginas, site.css com {len(css) // 1024} KB, em {args.saida}")
print("files.json pronto para o parâmetro `files` do Artifact (sem o index.html).")
if restos:
    print("Atenção: ainda há referências a /_next em:", ", ".join(restos))
