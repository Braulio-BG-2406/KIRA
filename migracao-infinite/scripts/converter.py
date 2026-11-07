"""catalogo.json (raspado) -> planilha de importação da plataforma lojas/ + mapa de fotos."""
import csv, json, sys
src, dest_csv, dest_fotos = sys.argv[1:4]
cat = json.load(open(src, encoding="utf-8"))
COL = ["nome", "marca", "categoria", "variacao", "sku", "codigo_barras", "preco", "preco_de", "custo",
       "estoque", "descricao", "ficha", "garantia", "vem_com", "ativo"]
GENERICA = "Fale com a gente pelo WhatsApp"
reais = lambda v: "" if v in (None, "") else f"{float(str(v).replace('.', '').replace(',', '.') if ',' in str(v) else v):.2f}".replace(".", ",")
linhas, fotos, vistos = [], {}, set()
for p in cat:
    desc = "" if (p.get("descricao") or "").startswith(GENERICA) else (p.get("descricao") or "")
    ficha = " | ".join(f"{a}: {b}" for a, b in p.get("especificacoes", []) if a not in ("Código", "Garantia"))
    vs = p["variantes"] or [{"nome": "Padrão", "sku": p["sku"], "preco": p["preco"], "preco_de": p["preco_de"],
                             "estoque": p["estoque"], "fotos": p["fotos"]}]
    for v in vs:
        sku = v.get("sku") or ""
        # mesmo código em duas opções: diferencia pela opção para não sobrescrever na importação
        if sku and sku in vistos: sku = f"{sku}-{v['nome']}"
        vistos.add(sku)
        linhas.append({"nome": p["nome"], "marca": "", "categoria": p.get("categoria") or "", "variacao": v["nome"],
                       "sku": sku, "codigo_barras": "", "preco": reais(v.get("preco")), "preco_de": reais(v.get("preco_de")),
                       "custo": "", "estoque": v.get("estoque") if v.get("estoque") is not None else 0,
                       "descricao": desc, "ficha": ficha, "garantia": "90 dias (garantia legal)", "vem_com": "", "ativo": "sim"})
    f = list(dict.fromkeys(p.get("fotos", []) + [x for v in vs for x in (v.get("fotos") or [])]))
    if f: fotos[p["slug"]] = {"nome": p["nome"], "fotos": f}
with open(dest_csv, "w", encoding="utf-8-sig", newline="") as fh:
    w = csv.DictWriter(fh, COL, delimiter=";"); w.writeheader(); w.writerows(linhas)
json.dump(fotos, open(dest_fotos, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"{len(cat)} produtos, {len(linhas)} linhas, {len(fotos)} produtos com foto, {sum(len(x['fotos']) for x in fotos.values())} fotos")
