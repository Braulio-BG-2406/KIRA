---
name: apr-seguranca
description: Cria APR (Análise Preliminar de Riscos) de segurança do trabalho da TJ MONTAGENS no modelo "ANEXO 9 - ANÁLISE PRELIMINAR DE RISCOS / DECLARAÇÃO DE MÉTODOS" (padrão Ambev), em planilha Excel (.xlsx) e PDF, a partir só da descrição da atividade. Claude escreve os passos da atividade, escolhe os riscos e as medidas de controle, e a planilha sai com cabeçalho, etapas padrão (planejamento, transporte e isolamento, rota de fuga NH3, bloqueio de energia, 5S), fotos ilustrativas e assinaturas, com as datas automáticas (elaboração hoje, início amanhã, término 30/12). Use sempre que o usuário pedir uma APR, "faz a APR de...", análise de riscos de um serviço, ou simplesmente mandar o nome de um serviço de manutenção/montagem na cervejaria (solda, troca de tubulação, instalação de válvula, medidor, plataforma, guarda-corpo, telhado, amônia, CO2, vapor, ETA/ETEI, packing), mesmo sem usar a sigla.
---

# APR – Anexo 9 (TJ MONTAGENS)

O usuário é da segurança do trabalho da TJ MONTAGENS, que presta serviço de
montagem e manutenção numa cervejaria Ambev. Ele manda o nome da atividade
(igual ao nome do arquivo que eles usam, ex.: "Troca de trecho de tubulação de
retorno de condensado na área externa próxima a maltose") e espera a APR pronta
no modelo Anexo 9, para imprimir e colher as assinaturas.

O modelo tem um padrão fixo, que o script já monta sozinho:

| Nº | Etapa | Quando entra |
|---|---|---|
| 1 | Planejamento da atividade e conscientização dos colaboradores | sempre |
| 2 | Transporte de materiais e ferramentas e isolamento de área | sempre (lista as ferramentas da atividade) |
| 3 | Procedimento Rota de Fuga em caso de vazamento de Amônia | `"utilidades": true` |
| 4 | Bloqueio de Energia | `"bloqueio_energia": true` |
| 5 | **Atividade principal** – passos, riscos e medidas | o que você escreve |
| 6 | 5S, limpeza e organização da área | sempre |
| — | **Lista de presença do treinamento da APR** (última página: declaração, 13 linhas de nome/cargo/assinatura/data e assinaturas dos responsáveis) | sempre |

## Regras fixas da empresa (pedidas pelo usuário — valem para toda APR)

1. **Lista de presença em todas as APRs.** O script já inclui a página
   "ANEXO 9 - LISTA DE PRESENÇA DO TREINAMENTO DA APR / DECLARAÇÃO DE MÉTODO"
   no final, com datas, descrição, responsáveis e local preenchidos. Nunca
   entregue uma APR sem ela.
2. **Sem redundância.** Nenhum assunto ou linha deve se repetir entre as etapas
   nem dentro da atividade principal. O que as etapas padrão já dizem (EPIs
   obrigatórios, distância de veículos, acessos seguros, telefone ao caminhar,
   aberturas no piso, isolamento do perímetro, bloqueio de energia, medidor e
   máscara de NH3, chuveiros de emergência...) não volta na atividade
   principal. O script remove sozinho as medidas do catálogo já cobertas
   (`temas_cobertos` das etapas e `temas` das medidas) e lista o que omitiu;
   mas o que **você** escreve (`passos`, `riscos_extras`, `medidas_extras`)
   também não pode repetir nada disso. Antes de entregar, rode
   `scripts/verificar_redundancia.py` (passo 7).

Seu trabalho é a atividade principal: descrever os passos de execução e
escolher os riscos certos. Os textos das etapas padrão e das medidas de cada
risco já estão em `assets/biblioteca.json`, no padrão de redação da empresa, e
vêm numerados (riscos 1, 2, 3... e medidas 1., 1.1., 1.2...) pelo script.

## Fluxo

1. **Entender a atividade.** Identifique o local (CM01, CM02, usina de CO2,
   packing linhas 501/502/511/512, brassagem, secador de fermento, ETA, ETEI,
   caldeira...), o que será feito e com quais equipamentos. Só pergunte se a
   atividade for vaga a ponto de mudar os riscos principais; caso contrário,
   assuma o cenário mais provável e diga no final o que assumiu.

2. **Escrever os `passos`** do jeito que a empresa escreve: em primeira pessoa
   do plural, um passo por item, dizendo o que será feito e com qual
   ferramenta/equipamento. O script coloca "1 Passo:", "2 Passo:"...
   Exemplo real: "Após a conferência de residual, iremos realizar a preparação
   para corte da mesma, utilizando a lixadeira e disco de corte;"
   Termine com o retoque de pintura (se houver solda) e o 5S da área.

3. **Listar as `ferramentas`** (uma por item): máquina de solda TIG/elétrica,
   lixadeira, furadeira de impacto, plataforma elevatória HB1430, caminhão
   munck, escada de abrir/extensiva, extensão e robô com DR...

4. **Escolher os `riscos`** do catálogo (tabela abaixo). Pense em cada passo e
   em cada ferramenta: solda → fumos, queimaduras, incêndio, choque;
   lixadeira → ruído, projeção, cortes; altura → a variante de queda certa;
   munck → carga suspensa, atropelamento, tombamento. A ordem não importa: o
   script agrupa por categoria (físicos, químicos, biológicos, ergonômicos,
   acidentes) e numera.

5. **Riscos fora do catálogo** vão em `riscos_extras`, com categoria, título e
   medidas no mesmo estilo (frases curtas, imperativas, verificáveis). Para
   ideias de medidas, consulte `references/biblioteca-riscos.md`. Para
   acrescentar uma medida específica a um risco do catálogo, use
   `medidas_extras`.

6. **Gerar a planilha:**

   ```bash
   python <caminho-da-skill>/scripts/gerar_apr.py dados.json --saida <pasta-de-saída> --pdf
   ```

   Datas automáticas (não coloque no JSON): elaboração = hoje, início =
   amanhã, término = 30/12. O arquivo sai com o nome da atividade, como os da
   empresa. Use como saída a pasta de entrega de arquivos do ambiente (ex.:
   `/mnt/user-data/outputs` no claude.ai); se não houver, o diretório atual.
   `--pdf` precisa do LibreOffice; se faltar, entregue só o .xlsx.

7. **Revisar redundância:**

   ```bash
   python <caminho-da-skill>/scripts/verificar_redundancia.py "<APR gerada>.xlsx"
   ```

   O resultado esperado é "0 possível(is) redundância(s)". Se apontar algo,
   corrija o JSON (tire a medida extra repetida, troque um risco extra por
   uma chave do catálogo) e gere de novo. Repetição entre o transporte (ida)
   e o 5S (volta) sobre carga do carrinho é aceitável.

8. **Entregar** o .xlsx (e o PDF) com um resumo curto: datas, etapas incluídas,
   riscos principais e as suposições feitas. Não repita a APR no chat.

Para corrigir algo depois (trocar risco, incluir passo, mudar local), edite o
JSON e rode o script de novo — não edite a planilha à mão.

## Formato do JSON

```json
{
  "atividade": "Troca de trecho de tubulação de retorno de condensado na área externa próxima a maltose",
  "local": "Área externa – próximo à maltose",
  "utilidades": false,
  "bloqueio_energia": true,
  "passos": [
    "Iremos realizar o bloqueio e a drenagem da linha junto com a operação Ambev e conferir a ausência de pressão;",
    "Após a liberação, iremos realizar o corte do trecho danificado utilizando a lixadeira e disco de corte;",
    "Iremos realizar a montagem do novo trecho e a soldagem com processo de soldagem elétrica;",
    "Realizar o retoque de pintura;",
    "Realizar o 5S da área."
  ],
  "ferramentas": ["Máquina de solda elétrica", "Lixadeira", "Ferramentas manuais", "Escada de abrir", "Extensão e robô com DR"],
  "riscos": ["ruido", "poeiras_fumos", "quimicos_tintas", "posturas", "movimentos_repetitivos",
             "cortes_prensamento", "projecao", "queimaduras", "vapor", "choque", "incendio",
             "batida_contra", "queda_mesmo_nivel", "queda_altura_escada"],
  "riscos_extras": [
    {"categoria": "acidente", "titulo": "Golpe de aríete no retorno da linha",
     "medidas": ["Retorno gradual da linha acompanhado pela operação Ambev.", "Manter a área isolada durante o retorno."]}
  ],
  "medidas_extras": {"vapor": ["Utilizar luva de proteção térmica até 200 °C."]}
}
```

Campos opcionais:
- `sequencia`: texto da coluna "Sequência de atividades" da atividade principal
  (padrão: o próprio nome da atividade).
- `descricao`: texto do campo "Descrição dos trabalhos" (padrão: a atividade).
- `sif` (padrão `true` = Precursor/Potencial/Real "Sim"), `full_time` e `pt`
  (padrão "SIM"). Use `"sif": false` só em atividade de baixo risco, sem
  altura, trabalho a quente, içamento ou energia perigosa.
- `fotos`: caminhos de fotos do local ou do equipamento que o usuário enviar;
  entram na coluna "Fotos ilustrativa" da atividade principal.
- `atividades`: lista de atividades principais (cada uma com `sequencia`,
  `passos`, `ferramentas`, `riscos`...) quando o serviço tiver mais de uma
  frente distinta. Sem esse campo, vale a atividade única do nível de cima.
- `etapas_extras`: etapas livres (`sequencia`, `tecnicas`, `riscos`, `medidas`
  como texto) que entram antes do 5S.
- `responsavel`, `telefone_responsavel`, `responsavel_seguranca`,
  `telefone_seguranca`: só se o usuário pedir outro nome; o padrão está em
  `assets/config.json`.

### Quando marcar `utilidades` e `bloqueio_energia`

- `utilidades: true` quando o serviço é na área de Utilidades / casas de
  máquinas de amônia (CM01, CM02, condensadores, torres da CM, compressores de
  NH3). Na dúvida, inclua: a etapa só acrescenta a rota de fuga.
- `bloqueio_energia: true` quando houver intervenção em equipamento ou linha
  com energia (elétrica, pressão, fluido, movimento): válvulas, tubulações,
  bombas, linhas do packing, painéis. Use `false` em serviço puramente
  estrutural sem abrir nada (plataforma, guarda-corpo, forro, escada, cobertura).

## Catálogo de riscos (`riscos`)

| Chave | Título na APR | Use quando |
|---|---|---|
| `ruido` | Exposição a ruído | quase sempre (área industrial, lixadeira, furadeira) |
| `poeiras_fumos` | Poeiras e fumos metálicos | solda, corte, lixamento |
| `quimicos_tintas` | Produtos químicos (tintas e solventes) | retoque de pintura, solventes |
| `nh3` | NH3 (amônia) – abertura de linha | abrir/intervir em linhas ou equipamentos de amônia |
| `nh3_proximidade` | Proximidade de linhas de amônia (NH3) | trabalho a quente ou montagem perto de linhas de amônia (CM01/CM02) sem abri-las |
| `co2` | CO2 (asfixia / baixa temperatura) | linhas, tanques e usina de CO2 |
| `quimicos_processo` | Produtos químicos de processo | assepsia, CIP, dosagem, ETA |
| `biologico` | Agentes biológicos | ETEI, efluente, lodo, água de torre |
| `posturas` | Posturas inadequadas | quase sempre |
| `movimentos_repetitivos` | Movimentos repetitivos | quase sempre |
| `cortes_prensamento` | Cortes / Prensamento de membros | ferramentas, montagem, chapas, tubos |
| `projecao` | Projeção de material e de partículas | lixadeira, corte, furação |
| `queimaduras` | Queimaduras | solda, corte, superfícies quentes |
| `vapor` | Contato com vapor, condensado ou água quente | vapor, condensado, caldeira, água quente |
| `pressao` | Energia residual de pressão | ar comprimido, linhas pressurizadas, testes |
| `choque` | Choque elétrico | qualquer ferramenta elétrica |
| `incendio` | Incêndio e explosão | trabalho a quente |
| `batida_contra` | Batida contra | quase sempre |
| `queda_mesmo_nivel` | Queda de pessoas de mesmo nível | quase sempre |
| `queda_altura` | Queda de nível diferente (acima de 2 m) | altura com cinto em estrutura/andaime |
| `queda_altura_pemt` | Queda de nível diferente (acima de 2 m) – PEMT | plataforma elevatória (HB1430 etc.) |
| `queda_altura_escada` | Queda de nível diferente (abaixo de 2 m) – escada | escada de abrir abaixo de 2 m |
| `queda_materiais` | Queda de materiais e ferramentas | serviço em altura sem içamento mecânico |
| `carga_suspensa` | Queda de material / carga suspensa (içamento) | munck, talha, guindaste |
| `atropelamento` | Atropelamento | munck, PEMT, veículos, empilhadeiras na área |
| `tombamento_equipamento` | Tombamento do equipamento (munck / PEMT) | munck, PEMT |
| `tombamento_escada` | Tombamento de escada | escada extensiva ou de abrir |
| `espaco_confinado` | Espaço confinado (atmosfera perigosa) | tanques, silos, filtros fechados, poços |

Não marque riscos que só repetem uma etapa padrão (ex.: `atropelamento` sem
munck/PEMT/veículo na atividade — o transporte já trata disso). Se um risco do
catálogo ficar sem nenhuma medida depois da deduplicação, o script o retira da
lista sozinho.

Coerência importa: se os passos têm solda, não pode faltar `poeiras_fumos`,
`queimaduras` e `incendio`; se há pintura, `quimicos_tintas`; se há munck,
`carga_suspensa`, `atropelamento` e `tombamento_equipamento`.

## Personalização

- `assets/config.json`: empresa, responsável, telefones e telefone da
  brigada (usado nos textos de emergência).
- `assets/fotos/`: pictogramas usados nas etapas padrão. Se o usuário mandar a
  foto da equipe, salve como `assets/fotos/equipe.jpg` para ela aparecer na
  etapa 1, como no modelo original.
- `assets/modelo-anexo9.xlsx`: molde tirado da planilha da empresa — linhas
  1-19: página da APR (cabeçalho, títulos da tabela, assinaturas); linhas
  20-46: lista de presença.
