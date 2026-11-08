"""Lê o catálogo público de infinitesemijoias.store e grava JSON por produto."""
import json, os, re, ssl, sys, time, html, urllib.request

BASE = "https://infinitesemijoias.store"
OUT = sys.argv[1]
os.makedirs(f"{OUT}/pages", exist_ok=True)
ctx = ssl.create_default_context(cafile="/root/.ccr/ca-bundle.crt")
UA = {"User-Agent": "Mozilla/5.0 (migracao Infinite Semijoias)"}

def get(url, dest=None):
    if dest and os.path.exists(dest):
        return open(dest, encoding="utf-8").read()
    for tent in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), context=ctx, timeout=40) as r:
                t = r.read().decode("utf-8")
            if dest:
                open(dest, "w", encoding="utf-8").write(t)
            time.sleep(0.4)
            return t
        except Exception as e:
            print("erro", url, e, file=sys.stderr); time.sleep(2 ** tent)
    return None

def txt(s):
    s = re.sub(r"<br\s*/?>", "\n", s); s = re.sub(r"</p>\s*<p[^>]*>", "\n\n", s)
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()

def secao(t, titulo):
    m = re.search(r">\s*" + titulo + r"\s*</h2>(.*?)(?=</section>)", t, re.S)
    return m.group(1) if m else ""

def ler(t):
    d = {}
    ld = re.search(r'<script type="application/ld\+json">(.*?)</script>', t, re.S)
    j = json.loads(ld.group(1)) if ld else {}
    d["nome"] = html.unescape(j.get("name", ""))
    d["sku"] = j.get("sku")
    of = j.get("offers", {})
    d["preco"] = of.get("price")
    d["disponivel"] = "InStock" in of.get("availability", "")
    bc = re.findall(r'<a href="/catalogo/([^"]+)"[^>]*>([^<]+)</a>', t.split('class="product"')[0])
    d["categoria_slug"], d["categoria"] = (bc[-1][0], html.unescape(bc[-1][1])) if bc else (None, None)
    gal = re.search(r'class="gallery"(.*?)class="details"', t, re.S)
    fotos = re.findall(r'/foto/\d+/([A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp))', gal.group(1)) if gal else []
    d["fotos"] = list(dict.fromkeys(fotos))
    det = t.split('class="details"', 1)[-1]
    m = re.search(r'class="(?:old|de|riscado|strike)[^"]*"[^>]*>\s*(?:de\s*)?R\$\s*([\d.,]+)', det)
    d["preco_de"] = m.group(1) if m else None
    m = re.search(r'data-max="(\d+)"', det); d["estoque"] = int(m.group(1)) if m else (0 if not d["disponivel"] else None)
    m = re.search(r'class="status ([^"]+)"[^>]*>([^<]+)<', det); d["status"] = m.group(2).strip() if m else None
    d["variantes"] = [(v, html.unescape(n)) for v, n in re.findall(r'<a class="chip" href="\?v=([^"]+)"[^>]*>([^<]+)</a>', det)]
    m = re.search(r'aria-current="true"[^>]*>([^<]+)</a>', det); d["variante_atual"] = html.unescape(m.group(1)) if m else None
    d["descricao_html"] = secao(t, "Descrição"); d["descricao"] = txt(d["descricao_html"])
    esp = secao(t, "Especificações")
    d["especificacoes"] = [(txt(a), txt(b)) for a, b in re.findall(r"<th[^>]*>(.*?)</th>\s*<td[^>]*>(.*?)</td>", esp, re.S)]
    return d

urls = [u for u in open(f"{OUT}/urls.txt").read().split() if "/produto/" in u]
res = []
for i, u in enumerate(urls):
    slug = u.rsplit("/", 1)[1]
    t = get(u, f"{OUT}/pages/{slug}.html")
    if not t: continue
    p = ler(t); p["slug"] = slug; p["url"] = u
    vs = []
    for vslug, vnome in p["variantes"]:
        vt = get(f"{u}?v={vslug}", f"{OUT}/pages/{slug}__{vslug}.html")
        if not vt: continue
        q = ler(vt)
        vs.append({"slug": vslug, "nome": vnome, "sku": q["sku"], "preco": q["preco"], "preco_de": q["preco_de"],
                   "estoque": q["estoque"], "disponivel": q["disponivel"], "fotos": q["fotos"]})
    p["variantes"] = vs
    res.append(p)
    if i % 25 == 0: print(i, slug, file=sys.stderr)
json.dump(res, open(f"{OUT}/catalogo.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("produtos:", len(res))
