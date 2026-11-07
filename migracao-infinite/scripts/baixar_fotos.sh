#!/bin/bash
# baixa as fotos listadas em fotos.json (tamanho 1920) para a pasta indicada
set -u
LISTA=$1; DEST=$2; mkdir -p "$DEST"
python3 -I -c "import json,sys;[print(f) for v in json.load(open(sys.argv[1])).values() for f in v['fotos']]" "$LISTA" | sort -u | while read -r f; do
  out="$DEST/${f%.*}.webp"; [ -s "$out" ] && continue
  curl -sS -f -A "Mozilla/5.0" "https://infinitesemijoias.store/foto/1920/$f" -o "$out" || echo "falhou $f"
  sleep 0.3
done
ls "$DEST" | wc -l
