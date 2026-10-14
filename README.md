# KIRA
Meu Bot particular

## Buscador de oportunidades automotivas

Procura anúncios de **carro, caminhão e cavalo mecânico**, compara cada um com a
**tabela FIPE** (ajustada pela quilometragem) e com o **preço dos outros anúncios
do mesmo modelo/ano**, desconta os custos de revenda e diz se é oportunidade:

- **Revenda** – lucro e margem estimados → `ÓTIMA`, `BOA`, `MARGEM BAIXA`, `SEM MARGEM` ou `RISCO`
- **Uso próprio** – quanto está abaixo do valor justo → `ÓTIMA`, `BOA`, `PREÇO JUSTO`, `CARA` ou `RISCO`
- **Nota de 0 a 100** para ordenar tudo, e alertas de risco lidos do texto do anúncio
  (leilão, sinistro/monta, enchente, ágio/financiamento, motor fundido, documento,
  preço baixo demais = possível golpe). Entende negação: "nunca batido, sem leilão" não gera alerta.

A análise é separada em **3 faixas**, cada uma com poucas buscas e custos próprios:

| Faixa | O que entra | Buscas (padrão) |
|---|---|---|
| **Pesados** | caminhões e cavalos mecânicos | 1 por termo: "cavalo mecânico", "caminhão truck", "caminhão toco" |
| **Populares** | carros de marcas nacionais (VW, Chevrolet, Fiat, Ford, Renault, Hyundai, Toyota, Honda, Nissan, Peugeot, Citroën) até R$ 90 mil | 1 por modelo: Onix, HB20, Gol, Polo, Argo, Mobi, Strada, Kwid, Sandero, Ka |
| **Premium** | BMW, Audi e Mercedes-Benz (carros; caminhão Mercedes vai para pesados) | 1 por marca, ou por modelo se você listar |

Com o arquivo de exemplo são 16 buscas (no máximo ~60 páginas consultadas). Tudo
isso se ajusta em `[faixas.pesados]`, `[faixas.populares]` e `[faixas.premium]` no
`buscas.toml`; `ativa = false` desliga uma faixa.

O resultado sai no terminal (os 5 melhores de cada faixa), numa planilha CSV e numa
página HTML com filtros (faixa, revenda × uso próprio, busca por texto), e as
melhores oportunidades novas podem ir para o **Telegram** (até 3 por faixa). Um histórico local marca anúncios
**novos** e **quedas de preço** (bom sinal para negociar).

### Instalação

Python 3.11 ou mais novo.

```bash
pip install -r requirements.txt
cp buscas.exemplo.toml buscas.toml   # e edite suas buscas e custos
```

### Uso

```bash
# 1) Ver funcionando agora, com a planilha de exemplo (dados fictícios, sem internet)
python -m buscador_auto importar exemplos/anuncios_exemplo.csv --sem-fipe
#    -> abre saida/ultimo.html no navegador

# 2) Rodar as 3 faixas do buscas.toml (OLX, Mercado Livre, Webmotors) e avisar no Telegram
python -m buscador_auto buscar --notificar
python -m buscador_auto buscar --faixa premium        # só uma faixa
python -m buscador_auto buscar --so "Onix"            # só as buscas com "Onix" no nome

# 3) Avaliar uma planilha de leilão, Marketplace, grupo de WhatsApp...
python -m buscador_auto importar lotes_leilao.xlsx --categoria cavalo

# 4) Avaliar um anúncio que você viu
python -m buscador_auto avaliar --titulo "Scania R 450 A 6x2" --ano 2019 --km 520000 --preco 410000 \
    --descricao "único dono, aceito proposta"

# 5) Consultar a FIPE
python -m buscador_auto fipe --marca Volvo --modelo "FH 540 6x4" --ano 2018
```

### Fontes de anúncios

| Fonte | Como funciona | Observação |
|---|---|---|
| `mercadolivre` | API oficial | Pode exigir token: crie um app em developers.mercadolivre.com.br e defina `ML_ACCESS_TOKEN`. |
| `olx` | Lê a página pública de resultados | A OLX às vezes bloqueia robôs (erro 403). |
| `webmotors` | API que alimenta a página de estoque | Só carros; costuma bloquear robôs. |
| planilha CSV/XLSX | `importar arquivo` | Funciona para qualquer origem: leilões, Facebook Marketplace, lojistas. |

Se uma fonte falhar, as outras continuam. Sites mudam de layout; quando uma fonte
parar de trazer anúncios, o resto do programa (FIPE, avaliação, relatórios) segue
funcionando com as demais fontes e com a planilha. Use pausas entre requisições
(`pausa_entre_requisicoes`) e respeite os termos de uso de cada site.

**Planilha**: as colunas são reconhecidas pelo nome (com ou sem acento). Só
`preco` e `titulo` (ou `modelo`) são obrigatórias: `titulo, preco, marca, modelo,
versao, ano, km, cidade, uf, url, descricao, categoria, vendedor, combustivel,
fipe, fonte, id`. Também aceita sinônimos como `Lance`, `Valor`, `Veículo`,
`Ano/Modelo`, `Lote`, `Valor FIPE`, `Observações`. Se a coluna `fipe` vier
preenchida, a consulta à FIPE é dispensada. Use `vendedor = leilao` para lotes de
leilão (o programa já desconta a desvalorização típica de veículo de leilão).
Cada linha é encaixada numa faixa pela marca/categoria; o que não for pesado,
popular nacional nem BMW/Audi/Mercedes aparece como "Outros".

### Como a conta é feita

1. **FIPE** pela API pública da parallelum (com cache local de 20-30 dias). O nome
   do anúncio é comparado com os modelos da tabela (ex.: "R450 6x2" → "R-450 A 6x2
   2p (diesel)(E5)"); quando a correspondência é incerta, aparece um aviso.
2. **Ajuste por km**: rodagem acima do normal da categoria tira valor (carro
   15 mil km/ano, caminhão 70 mil, cavalo 110 mil); abaixo do normal dá um bônus
   pequeno (até +3%).
3. **Preço de mercado**: mediana dos outros anúncios do mesmo modelo e ano
   encontrados na mesma rodada (mínimo 2).
4. **Revenda estimada** = o menor entre FIPE ajustada × `fator_revenda` e
   mercado × 0,98, menos a desvalorização dos alertas (leilão −25%, sinistro −30%...).
5. **Lucro** = revenda − preço − custos (transferência, vistoria cautelar,
   preparação, comissão, outros). **Margem** = lucro ÷ (preço + custos).
6. **Uso próprio** usa o menor desconto entre FIPE e mercado (FIPE de caminhão
   costuma ficar acima do que se pratica).

Cada faixa tem custos e metas próprios em `buscas.toml` (`[custos.populares]`,
`[custos.premium]`, `[custos.caminhao]`, `[custos.cavalo]`). O premium, por padrão,
considera preparação mais cara (pneus, freios), revenda a 92% da FIPE (gira mais
devagar), mais perda por km rodado e lucro mínimo de R$ 10 mil; para uso próprio
só é "boa compra" a partir de 8% abaixo da referência. Carro blindado recebe aviso,
porque a FIPE não inclui a blindagem. Os padrões são pontos de partida: ajuste com
os valores do seu despachante, da sua preparação e da sua região.

> As estimativas servem para **triagem**: separar os anúncios que valem uma
> ligação. Antes de fechar negócio, confira procedência e débitos no Detran,
> faça vistoria cautelar e avalie o veículo pessoalmente.

### Telegram

1. Fale com o **@BotFather** no Telegram e crie um bot; ele dá o token.
2. Mande uma mensagem para o seu bot e abra
   `https://api.telegram.org/bot<TOKEN>/getUpdates` para ver o seu `chat_id`.
3. Coloque os dois em `buscas.toml` (`[telegram]`) ou nas variáveis
   `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID`.

Só são avisados anúncios com nota ≥ `score_minimo_alerta`, sem risco alto, ainda
não avisados — ou que baixaram de preço desde o último aviso —, no máximo
`max_alertas_por_faixa` por faixa a cada execução.

### Site (Vercel ou no seu computador)

O mesmo buscador tem uma versão web: botões para pesquisar cada faixa, formulário
para avaliar um anúncio, importação de planilha e botão para baixar o CSV.

```bash
python -m buscador_auto servir            # abre em http://127.0.0.1:8000
python -m buscador_auto servir --host 0.0.0.0   # acessível pelo celular na mesma rede
```

**Publicar na Vercel** (uma vez só):

1. Em [vercel.com/new](https://vercel.com/new), importe o repositório `KIRA` do GitHub.
   Framework: **Other**; não precisa mudar build nem pasta (o `vercel.json` já define).
2. Em *Settings → Environment Variables*, crie (todas opcionais, mas a senha é recomendada,
   porque o site fica público):
   - `SENHA_ACESSO` – senha pedida na primeira pesquisa (fica salva no navegador);
   - `ML_ACCESS_TOKEN` – token do Mercado Livre;
   - `FIPE_TOKEN` e `FIPE_VERSAO=2` – se tiver token da FIPE (limite maior de consultas).
3. Cada `git push` publica de novo sozinho. A branch principal vira o endereço oficial;
   outras branches geram links de prévia.

Como funciona lá: a página fica em `public/index.html` e as funções em `api/`
(`/api/buscas`, `/api/buscar`, `/api/avaliar`, `/api/importar`). Cada busca roda numa
chamada separada (até 60 s), então a faixa inteira não estoura o tempo limite. As
buscas e custos vêm do `buscas.toml` (se estiver no repositório) ou do
`buscas.exemplo.toml`. O histórico de quedas de preço e o Telegram continuam sendo
coisa da versão de terminal/VPS, porque a Vercel não guarda arquivos entre chamadas.
OLX e Webmotors podem bloquear os servidores da Vercel; quando isso acontece, a
página mostra "falhou" naquela fonte e segue com as outras.

Se mudar o visual do relatório (`buscador_auto/modelo_relatorio.html`), rode
`python -m buscador_auto gerar-site` para atualizar `public/index.html`.

### Rodar sozinho (VPS)

```cron
# todo dia às 7h e às 19h
0 7,19 * * * cd /caminho/KIRA && python3 -m buscador_auto buscar --notificar >> dados/buscador.log 2>&1
```

### Testes

```bash
pip install pytest
python -m pytest
```
