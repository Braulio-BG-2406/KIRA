#!/bin/sh
# Monta o site da Vercel: envolve a página (escrita para o Claude, sem <head>) num documento HTML completo.
set -e
mkdir -p dist
{
  printf '%s' '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  printf '%s' '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'
  cat radar-ferias-2027.html
  printf '%s\n' '</body></html>'
} > dist/index.html
