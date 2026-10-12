# Arquitetura do gerador (planilha Excel)

Como foi construído o gerador da skill `apr-seguranca` e o que reaproveitar num
modelo novo. O código completo está em `exemplo_gerar_apr.py`.

## Sumário

1. Peças da skill gerada
2. Molde: copiar o bloco-protótipo
3. Biblioteca de textos fixos e catálogo
4. Blocos, continuação e paginação
5. Fotos
6. Datas e formatos
7. Calibração (o passo que mais economiza retrabalho)
8. Documentos Word (.docx)

---

## 1. Peças da skill gerada

```
<nome-da-skill>/
├── SKILL.md                 quando usar, fluxo, formato do JSON, regras de decisão
├── assets/
│   ├── modelo.xlsx          molde: só o bloco que se repete (criar_molde.py)
│   ├── biblioteca.json      textos fixos da empresa + catálogos (ex.: risco -> medidas)
│   ├── config.json          nomes, telefones, empresa — o que muda raramente
│   └── fotos/               pictogramas reutilizáveis
├── scripts/gerar_<doc>.py   tudo que é mecânico
└── references/              conhecimento extra, lido só quando preciso
```

Divisão de trabalho: **o Claude escreve só a parte variável num JSON** (passos,
escolha de itens do catálogo, extras); **o script faz o resto** (datas,
numeração, páginas, continuação, fotos, PDF). Isso deixa o resultado
consistente e barato: o Claude não reescreve os textos fixos a cada documento.

## 2. Molde: copiar o bloco-protótipo

O molde guarda uma página-tipo (cabeçalho, títulos da tabela, uma linha de
conteúdo, assinaturas). O gerador:

1. Carrega o molde e lê, para as linhas do protótipo, o valor e o estilo
   (`copy(cell._style)`) de cada célula, as alturas de linha e as mesclas.
2. Desfaz todas as mesclas e zera as quebras de página do molde.
3. Reescreve a planilha a partir da linha 1, página por página, copiando as
   faixas do protótipo (cabeçalho → títulos → linhas de conteúdo → assinaturas)
   com deslocamento, e preenche as células variáveis.
4. Aplica todas as mesclas **no final** (mesclar antes de escrever apaga
   valores e estilos das células cobertas).
5. Adiciona `Break(id=última_linha_da_página)` em `ws.row_breaks` e ajusta
   `ws.print_area`.

Trabalhar na mesma aba do molde preserva larguras, colunas ocultas,
configuração de impressão, rodapé ("Página &P / &N") e zoom sem esforço.

## 3. Biblioteca de textos fixos e catálogo

- Copie os textos fixos **literalmente** dos exemplos (é o padrão que a
  empresa e o cliente já aprovaram). Corrija só erros de digitação evidentes e
  avise o usuário.
- Quando o documento tem itens que se repetem com o mesmo texto (ex.: risco →
  lista de medidas), monte um **catálogo**: chave curta → título, categoria,
  lista de medidas, fotos. O Claude escolhe as chaves; o script numera
  (`n.`, `n.1.`, `n.2.`...) e agrupa por categoria.
- Deixe espaço para o que não está no catálogo: `itens_extras` (título +
  medidas) e `medidas_extras` (acrescentar a um item do catálogo).
- Use marcadores `{campo}` nos textos para dados da config (ex.: `{brigada}`)
  e formate com `str.format(**config)`.

## 4. Blocos, continuação e paginação

- **Estimativa de altura:** para cada coluna de conteúdo, linhas visuais =
  soma de `ceil(len(linha) * 1.05 / caracteres_por_linha)`. Altura do bloco =
  maior número de linhas × altura da linha + folga. Os caracteres por linha
  são calibrados (seção 7).
- **Fatiar:** quando o texto não cabe numa página, divida em fatias cortando
  de preferência entre parágrafos (linhas em branco). As fatias seguintes
  levam "Continuação..." nas colunas que acabaram.
- **Nada sozinho:** cole rodapés curtos (ex.: telefone de emergência) ao último
  parágrafo com `\n` simples, para não sobrar uma fatia minúscula.
- **Linha > 409 pt** (limite do Excel): use duas linhas mescladas
  verticalmente com metade da altura cada.
- **Paginação:** encha cada página com blocos até a capacidade (no Anexo 9,
  ~585 pt de conteúdo por página — meça no modelo original somando as alturas
  das linhas de conteúdo de uma página cheia).

## 5. Fotos

- Coluna de fotos: âncora `OneCellAnchor` com `AnchorMarker(col, colOff,
  row, rowOff)` e `XDRPositiveSize2D` em EMU (`pixels_to_EMU`).
- Até 2 fotos: uma coluna; 3–4: grade 2×2. Redimensione mantendo a proporção,
  sem ampliar, e centralize na célula.
- Se o deslocamento vertical passar da altura da primeira linha (bloco de
  duas linhas), ancore na linha de baixo.
- Reduza as imagens da skill para no máximo ~700 px antes de salvar em
  `assets/fotos/`.
- Fotos com pessoas ou do local do cliente **não** entram na skill sem o
  usuário autorizar; ofereça um nome de arquivo opcional (ex.:
  `assets/fotos/equipe.jpg`) que o script usa se existir.

## 6. Datas e formatos

- Calcule datas no script, no fuso do usuário
  (`datetime.now(ZoneInfo("America/Sao_Paulo"))`), nunca no JSON.
- Escreva datas como `date` e force `cell.number_format = "DD/MM/YYYY"`. O
  formato "data curta" do molde depende do idioma do computador: no PDF gerado
  num servidor em inglês sai 10/12/2026 em vez de 12/10/2026.
- Nome do arquivo de saída igual ao padrão da empresa (no caso da APR, o nome
  da atividade), sem caracteres proibidos no Windows (`<>:"/\|?*`).
- PDF: `soffice --headless --convert-to pdf --outdir <pasta> <arquivo.xlsx>`.

## 7. Calibração

Sem isso, o texto fica cortado ou sobra metade da linha em branco.

1. Gere um exemplo e rode `renderizar.py --dpi 120 --paginas N` numa página
   cheia de texto.
2. Compare a altura ocupada pelo texto com a altura da linha e conte quantos
   caracteres cabem por linha em cada coluna (procure a linha mais longa que
   não quebrou).
3. Ajuste `LARGURA` (caracteres por coluna) e `ALTURA_TEXTO`.
   Referência Arial 10: o LibreOffice usa ~12,3 pt por linha, o Excel
   12,75 pt — use 12,75 para não cortar no Excel do usuário.
4. Refaça até o texto ocupar ~90% da linha, sem cortar.

## 8. Documentos Word (.docx)

Mesma ideia, ferramentas diferentes: molde .docx com marcadores e
`docxtpl` (Jinja) ou `python-docx` para preencher; tabelas repetidas com
laço no molde; conversão para PDF pelo LibreOffice. Se o ambiente tiver a
skill de .docx, siga as orientações dela para editar o molde.
