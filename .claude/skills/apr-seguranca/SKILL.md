---
name: apr-seguranca
description: Cria APR (Análise Preliminar de Riscos / Análise Preliminar de Risco) de segurança do trabalho em planilha Excel (.xlsx, e PDF opcional) a partir só da descrição da atividade — Claude levanta as etapas, os perigos, os possíveis danos, as medidas de controle, EPIs, EPCs e permissões (PT, PT a quente, PTA, PET), com as datas preenchidas automaticamente (elaboração hoje, execução amanhã, validade até 30/12). Use sempre que o usuário pedir uma APR, análise de risco de um serviço, "faz a APR de...", "preciso da análise de riscos para...", ou simplesmente mandar o nome de um serviço de manutenção/montagem industrial (solda, troca de tubulação, instalação de válvula, montagem de guarda-corpo, serviço em telhado, amônia, CO2, vapor, ETA/ETEI) esperando a APR pronta, mesmo que não use a sigla.
---

# APR – Análise Preliminar de Riscos

O usuário (segurança do trabalho da TJ MONTAGENS, empresa de montagem e
manutenção industrial que presta serviço numa cervejaria) informa a atividade
a ser realizada. Você entrega a APR pronta em planilha, com etapas, riscos e
medidas de controle já escritos, para a equipe só revisar, imprimir e assinar.

O objetivo é uma APR que um técnico de segurança assinaria sem reescrever:
específica do serviço, com medidas práticas e verificáveis em campo, e sem
riscos que não existem na atividade.

## Fluxo

1. **Entender a atividade.** Leia o pedido e identifique: local/área da planta
   (CM01, CM02, usina de CO2, packing linhas 501/502/511/512, brassagem, secador
   de fermento, ETA, ETEI, caldeira, subestação, refeitório...), fluido ou
   energia envolvida (amônia, CO2, vapor, condensado, água quente, ar
   comprimido, produto químico, biogás, eletricidade), se haverá solda/corte,
   altura, espaço confinado, içamento, intervenção em máquina.
   Só pergunte ao usuário se a atividade estiver vaga a ponto de mudar os
   riscos principais (ex.: "serviço na CM01" sem dizer qual). Caso contrário,
   assuma o cenário mais provável e diga no final quais suposições fez.

2. **Montar as etapas.** Divida o serviço em 6 a 10 etapas na ordem real de
   execução. Use o esqueleto da seção 1 de `references/biblioteca-riscos.md`
   (liberação/DDS → transporte de materiais → isolamento → bloqueio de energias
   → etapas técnicas → testes/retorno → desmobilização) e detalhe as etapas
   técnicas do serviço específico (ex.: "Corte do trecho danificado com
   esmerilhadeira", "Ponteamento e soldagem do novo trecho", "Teste de
   estanqueidade").

3. **Levantar riscos e medidas por etapa.** Leia
   `references/biblioteca-riscos.md` e use as seções que se aplicam. Para cada
   etapa, liste de 1 a 4 riscos com:
   - `perigo`: a fonte do risco, específica ("Vazamento de amônia residual ao
     abrir o flange", não só "Químico")
   - `dano`: as consequências possíveis
   - `medidas`: lista de medidas de controle, na ordem da hierarquia —
     eliminar/isolar a energia, controles de engenharia, procedimentos e
     permissões, por último EPI. Prefira medidas verificáveis ("extintor PQS
     junto ao ponto de solda", "vigia de incêndio por 30 min após o término")
     a frases vagas ("ter cuidado").
   Adapte o texto da biblioteca ao serviço: cite o equipamento, a área e o
   fluido reais.

4. **Completar o restante:** permissões/documentos, ferramentas e equipamentos,
   EPIs, EPCs/sinalização, procedimentos de emergência e recomendações gerais
   (seções 23 a 25 da biblioteca).

5. **Gerar a planilha.** Escreva o JSON (formato abaixo) e rode:

   ```bash
   python <caminho-da-skill>/scripts/gerar_apr.py dados.json --saida <pasta-de-saída> --pdf
   ```

   O script calcula as datas sozinho — não coloque datas no JSON:
   - **Data de elaboração:** hoje (fuso de Brasília)
   - **Data de execução:** o dia seguinte
   - **Validade:** 30/12 do ano da execução
   O arquivo sai com o nome da atividade (ex.: `Troca de trecho de tubulação
   de incêndio na ETEI.xlsx`), igual ao padrão que o usuário já usa.
   Use como pasta de saída a pasta que o ambiente usa para entregar arquivos ao
   usuário (ex.: `/mnt/user-data/outputs` no claude.ai); se não houver, o
   diretório atual. `--pdf` precisa do LibreOffice; se não houver, entregue só
   o .xlsx.

6. **Entregar.** Envie o arquivo e responda em poucas linhas: datas
   (elaboração/execução/validade), principais riscos considerados, permissões
   exigidas e as suposições que você fez. Não repita a APR inteira no chat.

Se o usuário pedir alteração (incluir risco, mudar local, trocar responsável),
edite o JSON e rode o script de novo — não edite a planilha à mão.

## Formato do JSON

```json
{
  "atividade": "Troca de trecho de tubulação de retorno de condensado na área externa próxima à maltose",
  "local": "Área externa – próximo à maltose",
  "descricao": "Remoção de trecho corroído de 3\" da linha de retorno de condensado e montagem de novo trecho em aço carbono com solda.",
  "empresa": "TJ MONTAGENS",
  "contratante": "",
  "responsavel": "",
  "numero": "",
  "permissoes": ["Permissão de Trabalho (PT)", "Permissão de Trabalho a Quente (PTQ)", "Permissão de Trabalho em Altura (PTA)", "Bloqueio e etiquetagem (LOTO) das válvulas de condensado"],
  "ferramentas": ["Máquina de solda inversora", "Esmerilhadeira 7\" com coifa", "Andaime tubular", "Chaves de boca e combinadas", "Extintor PQS 6 kg"],
  "etapas": [
    {
      "etapa": "Liberação do serviço, DDS e emissão das permissões",
      "riscos": [
        {
          "perigo": "Início do serviço sem liberação ou com desconhecimento dos riscos",
          "dano": "Acidentes diversos",
          "medidas": ["Emitir PT, PTQ e PTA antes do início", "DDS com todos os executantes sobre esta APR", "Conferir ASO e treinamentos NR-35"]
        }
      ]
    }
  ],
  "epis": ["Capacete com jugular", "Óculos de segurança", "..."],
  "epcs": ["Fita zebrada e cones", "Manta anti-chama", "..."],
  "emergencia": ["..."],
  "recomendacoes": ["..."]
}
```

- `empresa` padrão é TJ MONTAGENS. `contratante`, `responsavel` e `numero`
  ficam vazios se o usuário não informou — são preenchidos à mão na
  impressão. Não invente nomes de pessoas.
- `medidas` é uma lista; cada item vira uma linha com marcador na célula.
- `linhas_equipe` (opcional, padrão 8) define quantas linhas em branco ficam
  para assinatura da equipe.

## Cuidados de conteúdo

- Coerência entre seções: se uma etapa tem solda, a PT a quente, a máscara de
  solda e o extintor precisam aparecer em permissões, EPIs e EPCs. Se há
  altura, o cinto e a PTA também.
- Serviços em linhas de amônia, CO2, vapor ou produto químico começam sempre
  por drenagem/despressurização/bloqueio feito ou acompanhado pela operação —
  é o ponto onde mais acontecem acidentes graves nesse tipo de planta.
- Cite NRs quando ajudam (NR-10, NR-12, NR-13, NR-33, NR-35), sem encher o
  texto de referências.
- Escreva em português do Brasil, frases curtas, no padrão de campo.
