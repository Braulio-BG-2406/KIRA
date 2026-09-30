// Kira — Power BI: sub-workflow da ferramenta consultar_powerbi da Kira. Consulta o Power BI da empresa
// pela API oficial, com a conta do dono: lista os modelos e relatórios que ele pode ver, mostra as tabelas
// e colunas de um modelo e roda consultas DAX (só leitura). Só responde no ambiente de trabalho.
import { workflow, node, trigger, ifElse, expr, newCredential } from '@n8n/workflow-sdk';

const credPowerBi = newCredential('Power BI');
const AMBIENTE = 'TRABALHO';
const API = 'https://api.powerbi.com/v1.0/myorg';

const quandoConsultar = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: {
    name: 'Quando a Kira consultar o Power BI',
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'ambiente', type: 'string' },
          { name: 'tipo', type: 'string' },
          { name: 'modelo', type: 'string' },
          { name: 'dax', type: 'string' },
          { name: 'limite', type: 'number' },
        ],
      },
    },
    position: [0, 300],
  },
  output: [{ ambiente: 'TRABALHO', tipo: 'listar', modelo: '', dax: '', limite: 50 }],
});

const soNoAmbiente = ifElse({
  version: 2.3,
  config: {
    name: 'Só no ambiente de trabalho',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          {
            id: 'cond-ambiente',
            leftValue: expr("{{ String($json.ambiente ?? '').trim().toUpperCase() }}"),
            rightValue: AMBIENTE,
            operator: { type: 'string', operation: 'equals' },
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
    position: [220, 300],
  },
});

const foraDoAmbiente = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Fora do ambiente de trabalho',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'fora-ok', name: 'ok', value: false, type: 'boolean' },
          { id: 'fora-erro', name: 'erro', value: 'O Power BI da empresa só pode ser consultado no ambiente de trabalho.', type: 'string' },
          {
            id: 'fora-orientacao',
            name: 'orientacao',
            value: 'Diga ao dono, em uma frase, que esses dados são do ambiente de trabalho e que ele pode trocar dizendo "modo trabalho". Não use nem invente dados do Power BI aqui.',
            type: 'string',
          },
        ],
      },
      options: {},
    },
    position: [440, 520],
  },
  output: [{ ok: false, erro: 'O Power BI da empresa só pode ser consultado no ambiente de trabalho.', orientacao: 'Diga ao dono que troque de ambiente.' }],
});

const listarAreas = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Listar áreas de trabalho',
    parameters: {
      method: 'GET',
      url: API + '/groups',
      authentication: 'genericCredentialType',
      genericAuthType: 'oAuth2Api',
      options: { timeout: 30000 },
    },
    credentials: { oAuth2Api: credPowerBi },
    onError: 'continueErrorOutput',
    position: [440, 300],
  },
  output: [{ value: [{ id: 'g1', name: 'Comercial' }] }],
});

const areasDeTrabalho = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Áreas de trabalho',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Áreas de trabalho (workspaces) onde procurar os modelos e relatórios: o \"Meu workspace\" e as que o\n// dono pode ver no Power BI (no máximo 30, para a consulta não demorar).\nconst grupos = Array.isArray($input.first().json.value) ? $input.first().json.value : [];\nreturn [\n  { json: { grupo_id: '', area: 'Meu workspace' } },\n  ...grupos.slice(0, 30).map((g) => ({ json: { grupo_id: String(g.id ?? ''), area: String(g.name ?? '') } })),\n];\n" },
    position: [660, 300],
  },
  output: [{ grupo_id: 'g1', area: 'Comercial' }],
});

const listarModelos = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Listar modelos',
    parameters: {
      method: 'GET',
      url: expr("{{ $json.grupo_id ? '" + API + "/groups/' + $json.grupo_id + '/datasets' : '" + API + "/datasets' }}"),
      authentication: 'genericCredentialType',
      genericAuthType: 'oAuth2Api',
      options: { timeout: 30000 },
    },
    credentials: { oAuth2Api: credPowerBi },
    onError: 'continueRegularOutput',
    position: [880, 300],
  },
  output: [{ value: [{ id: 'd1', name: 'Pedidos' }] }],
});

const listarRelatorios = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Listar relatórios',
    parameters: {
      method: 'GET',
      url: expr(
        "{{ $('Áreas de trabalho').item.json.grupo_id ? '" + API + "/groups/' + $('Áreas de trabalho').item.json.grupo_id + '/reports' : '" + API + "/reports' }}",
      ),
      authentication: 'genericCredentialType',
      genericAuthType: 'oAuth2Api',
      options: { timeout: 30000 },
    },
    credentials: { oAuth2Api: credPowerBi },
    onError: 'continueRegularOutput',
    position: [1100, 300],
  },
  output: [{ value: [{ name: 'Painel de Pedidos', datasetId: 'd1' }] }],
});

const escolherModelo = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Escolher modelo',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Junta os modelos semânticos (datasets) e relatórios de todas as áreas de trabalho e decide o que fazer:\n// listar tudo, ou achar o modelo pedido (pelo nome do modelo ou do relatório) e montar a consulta DAX.\nconst pedido = $('Quando a Kira consultar o Power BI').first().json;\nconst areas = $('Áreas de trabalho').all().map((i) => i.json);\nconst modelosPorArea = $('Listar modelos').all().map((i) => i.json);\nconst relatoriosPorArea = $('Listar relatórios').all().map((i) => i.json);\n\nconst semAcento = (s) =>\n  String(s ?? '')\n    .normalize('NFD')\n    .replace(/\\p{M}/gu, '')\n    .toLowerCase()\n    .replace(/[^a-z0-9]+/g, ' ')\n    .trim();\nconst TIPOS = {\n  listar: 'listar', lista: 'listar', modelos: 'listar', relatorios: 'listar', paineis: 'listar',\n  estrutura: 'estrutura', tabelas: 'estrutura', colunas: 'estrutura', campos: 'estrutura',\n  consulta: 'consulta', consultar: 'consulta', dax: 'consulta', dados: 'consulta',\n};\nconst tipo = TIPOS[semAcento(pedido.tipo || 'listar')] || 'listar';\n\n// Alguns nomes vêm codificados como em endereço de internet (\"Relat%C3%B3rio\").\nconst nomeLegivel = (s) => {\n  const t = String(s ?? '');\n  try {\n    return /%[0-9a-f]{2}/i.test(t) ? decodeURIComponent(t) : t;\n  } catch (e) {\n    return t;\n  }\n};\n\n// Catálogo: cada modelo com a área e os relatórios que usam ele.\nconst modelos = [];\nconst relatorios = [];\nareas.forEach((area, i) => {\n  for (const d of modelosPorArea[i]?.value ?? []) {\n    if (!d?.id || modelos.some((m) => m.id === d.id)) continue;\n    modelos.push({ id: String(d.id), nome: nomeLegivel(d.name), area: area.area, grupo_id: area.grupo_id, relatorios: [] });\n  }\n  for (const r of relatoriosPorArea[i]?.value ?? []) {\n    if (r?.datasetId) relatorios.push({ nome: nomeLegivel(r.name), modelo_id: String(r.datasetId) });\n  }\n});\n// Relatórios compartilhados com o dono cujo modelo fica numa área de trabalho em que ele não está: o modelo\n// entra no catálogo com o nome do relatório e é consultado pelo endereço geral de modelos.\nfor (const r of relatorios) {\n  let m = modelos.find((x) => x.id === r.modelo_id);\n  if (!m) {\n    m = { id: r.modelo_id, nome: r.nome, area: 'compartilhado com você', grupo_id: '', relatorios: [] };\n    modelos.push(m);\n  }\n  if (!m.relatorios.includes(r.nome)) m.relatorios.push(r.nome);\n}\nconst semAcesso = areas.filter((a, i) => modelosPorArea[i]?.error).map((a) => a.area);\nconst resumo = (m) => ({ modelo: m.nome, area: m.area, relatorios: m.relatorios.slice(0, 10) });\n\nconst responder = (resposta) => [{ json: { consultar: false, resposta } }];\nif (tipo === 'listar') {\n  return responder({\n    ok: true,\n    tipo,\n    total: modelos.length,\n    modelos: modelos.slice(0, 60).map(resumo),\n    ...(semAcesso.length ? { areas_sem_acesso: semAcesso } : {}),\n    orientacao: modelos.length\n      ? 'Para consultar, use tipo \"estrutura\" com o nome do modelo (ou do relatório) e depois tipo \"consulta\" com uma consulta DAX.'\n      : 'Nenhum modelo encontrado: o dono precisa ter acesso (com permissão de criar conteúdo) a algum modelo no Power BI.',\n  });\n}\n\nconst busca = semAcento(pedido.modelo);\nif (!busca) return responder({ ok: false, tipo, erro: 'Faltou dizer qual modelo (ou relatório) consultar.', modelos: modelos.map(resumo) });\nconst porNome = (m) => [m.nome, ...m.relatorios].map(semAcento);\nconst modelo =\n  modelos.find((m) => m.id === String(pedido.modelo).trim()) ||\n  modelos.find((m) => porNome(m).includes(busca)) ||\n  modelos.find((m) => porNome(m).some((n) => n.includes(busca) || (n && busca.includes(n))));\nif (!modelo) {\n  return responder({ ok: false, tipo, erro: `Não achei no Power BI um modelo ou relatório com \"${pedido.modelo}\".`, modelos: modelos.slice(0, 60).map(resumo) });\n}\n\nlet dax;\nif (tipo === 'estrutura') {\n  dax = 'EVALUATE COLUMNSTATISTICS()';\n} else {\n  dax = String(pedido.dax ?? '').trim();\n  if (!/^(DEFINE|EVALUATE)\\b/i.test(dax)) {\n    return responder({\n      ok: false,\n      tipo,\n      modelo: modelo.nome,\n      erro: 'A consulta precisa ser DAX e começar com EVALUATE (ou DEFINE).',\n      orientacao: 'Veja as tabelas e colunas com tipo \"estrutura\" e escreva, por exemplo: EVALUATE TOPN(20, SUMMARIZECOLUMNS(Tabela[Coluna], \"Total\", SUM(Tabela[Valor])), [Total], DESC)',\n    });\n  }\n}\nconst limite = Math.min(Math.max(Math.round(Number(pedido.limite) || 50), 1), 200);\nconst base = (modelo.grupo_id ? `https://api.powerbi.com/v1.0/myorg/groups/${modelo.grupo_id}` : 'https://api.powerbi.com/v1.0/myorg') + `/datasets/${modelo.id}`;\nreturn [{ json: { consultar: true, tipo, modelo: { nome: modelo.nome, area: modelo.area, relatorios: modelo.relatorios }, base, dax, limite } }];\n" },
    position: [1320, 300],
  },
  output: [{ consultar: true, tipo: 'estrutura', modelo: { nome: 'Pedidos', area: 'Comercial', relatorios: ['Painel de Pedidos'] }, base: API + '/groups/g1/datasets/d1', dax: 'EVALUATE COLUMNSTATISTICS()', limite: 50 }],
});

const consultarModelo = ifElse({
  version: 2.3,
  config: {
    name: 'Consultar o modelo?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          { id: 'cond-consultar', leftValue: expr('{{ $json.consultar === true }}'), rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } },
        ],
        combinator: 'and',
      },
      options: {},
    },
    position: [1540, 300],
  },
});

// Hora da última atualização do modelo (para a Kira dizer de quando são os dados).
const ultimaAtualizacao = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Última atualização',
    parameters: {
      method: 'GET',
      url: expr("{{ $json.base + '/refreshes' }}"),
      authentication: 'genericCredentialType',
      genericAuthType: 'oAuth2Api',
      sendQuery: true,
      specifyQuery: 'keypair',
      queryParameters: { parameters: [{ name: '$top', value: '1' }] },
      options: { timeout: 30000 },
    },
    credentials: { oAuth2Api: credPowerBi },
    onError: 'continueRegularOutput',
    position: [1760, 200],
  },
  output: [{ value: [{ endTime: '2026-09-30T11:15:00Z', status: 'Completed' }] }],
});

// Consulta DAX (só leitura). Os erros voltam no corpo da resposta para a Kira corrigir a consulta.
const executarDax = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Executar DAX',
    parameters: {
      method: 'POST',
      url: expr("{{ $('Escolher modelo').first().json.base + '/executeQueries' }}"),
      authentication: 'genericCredentialType',
      genericAuthType: 'oAuth2Api',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr("{{ JSON.stringify({ queries: [{ query: $('Escolher modelo').first().json.dax }], serializerSettings: { includeNulls: true } }) }}"),
      options: { timeout: 60000, response: { response: { fullResponse: true, neverError: true } } },
    },
    credentials: { oAuth2Api: credPowerBi },
    onError: 'continueRegularOutput',
    position: [1980, 200],
  },
  output: [{ statusCode: 200, body: { results: [{ tables: [{ rows: [{ '[Table Name]': 'Pedidos', '[Column Name]': 'Cliente' }] }] }] } }],
});

const eEstrutura = ifElse({
  version: 2.3,
  config: {
    name: 'É estrutura?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          {
            id: 'cond-estrutura',
            leftValue: expr("{{ $('Escolher modelo').first().json.tipo === 'estrutura' }}"),
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
    position: [2200, 200],
  },
});

const listarMedidas = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Listar medidas',
    parameters: {
      method: 'POST',
      url: expr("{{ $('Escolher modelo').first().json.base + '/executeQueries' }}"),
      authentication: 'genericCredentialType',
      genericAuthType: 'oAuth2Api',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr(
        "{{ JSON.stringify({ queries: [{ query: 'EVALUATE SELECTCOLUMNS(INFO.VIEW.MEASURES(), \"Tabela\", [Table], \"Medida\", [Name])' }], serializerSettings: { includeNulls: true } }) }}",
      ),
      options: { timeout: 60000, response: { response: { fullResponse: true, neverError: true } } },
    },
    credentials: { oAuth2Api: credPowerBi },
    onError: 'continueRegularOutput',
    position: [2420, 100],
  },
  output: [{ statusCode: 200, body: { results: [{ tables: [{ rows: [{ '[Tabela]': 'Pedidos', '[Medida]': 'Total' }] }] }] } }],
});

const montarResultado = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar resultado',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Monta a resposta para a Kira: a estrutura do modelo (tabelas, colunas e medidas) ou as linhas da consulta,\n// com a hora da última atualização do modelo. Erros do Power BI viram uma explicação curta.\nconst escolha = $('Escolher modelo').first().json;\nif (!escolha.consultar) return [{ json: escolha.resposta }];\n\nconst resposta = $('Executar DAX').first().json;\nconst corpo = resposta.body ?? resposta;\nconst status = Number(resposta.statusCode) || (corpo?.error ? 400 : 200);\nconst base = { tipo: escolha.tipo, modelo: escolha.modelo.nome, area: escolha.modelo.area };\n\n// Hora da última atualização do modelo (horário de Brasília).\nconst atualizacao = $('Última atualização').isExecuted ? $('Última atualização').first().json?.value?.[0] : null;\nconst quando = atualizacao?.endTime || atualizacao?.startTime;\nif (quando) {\n  const local = new Date(Date.parse(quando) - 3 * 3600000).toISOString();\n  base.atualizado_em = `${local.slice(8, 10)}/${local.slice(5, 7)}/${local.slice(0, 4)} às ${local.slice(11, 16)}`;\n  if (atualizacao.status && atualizacao.status !== 'Completed') base.ultima_atualizacao = atualizacao.status;\n}\n\nconst detalhe = (c) => {\n  const pbi = c?.error?.['pbi.error'];\n  const msg = (pbi?.details ?? []).find((d) => /message/i.test(d.code ?? ''))?.detail?.value;\n  return String(msg || c?.error?.message || c?.error?.code || c?.message || '').slice(0, 400);\n};\nif (status >= 400 || corpo?.error) {\n  const semPermissao =\n    status === 401 || status === 403 || (status === 404 && /PowerBIEntityNotFound|required permissions/i.test(JSON.stringify(corpo ?? '')));\n  if (semPermissao) {\n    return [{\n      json: {\n        ok: false,\n        ...base,\n        erro: 'A conta conectada ao Power BI pode ver este relatório, mas não tem permissão para consultar os dados dele pela API.',\n        orientacao: 'Explique ao dono que quem administra este Power BI (o dono do modelo ou o administrador da área de trabalho) precisa dar à conta conectada na Kira a permissão de criar conteúdo (Build) no modelo semântico deste relatório; sem isso, você não consegue ler esses dados. Não invente números.',\n      },\n    }];\n  }\n  return [{ json: { ok: false, ...base, erro: `A consulta DAX deu erro: ${detalhe(corpo) || `HTTP ${status}`}`, orientacao: 'Corrija a consulta (use os nomes de tabelas e colunas da estrutura) e tente de novo; se não der, explique ao dono.' } }];\n}\n\nconst linhas = corpo?.results?.[0]?.tables?.[0]?.rows ?? [];\n// \"Tabela[Coluna]\" ou \"[Coluna]\" -> \"Coluna\" (se repetir, fica o nome completo)\nconst limparChaves = (linha) => {\n  const saida = {};\n  for (const [k, v] of Object.entries(linha)) {\n    const curto = (/\\[([^\\]]+)\\]$/.exec(k) || [])[1] || k;\n    saida[curto in saida ? k : curto] = typeof v === 'string' && v.length > 300 ? v.slice(0, 299) + '…' : v;\n  }\n  return saida;\n};\n\nif (escolha.tipo === 'estrutura') {\n  const tabelas = {};\n  for (const l of linhas.map(limparChaves)) {\n    const tabela = String(l['Table Name'] ?? '');\n    const coluna = String(l['Column Name'] ?? '');\n    if (!tabela || /^(DateTableTemplate_|LocalDateTable_)/.test(tabela) || /^RowNumber-/.test(coluna)) continue;\n    (tabelas[tabela] ??= []).push(coluna);\n  }\n  const medidas = {};\n  const respostaMedidas = $('Listar medidas').isExecuted ? $('Listar medidas').first().json : null;\n  const linhasMedidas = (respostaMedidas?.body ?? respostaMedidas)?.results?.[0]?.tables?.[0]?.rows ?? [];\n  for (const l of linhasMedidas.map(limparChaves)) {\n    if (l.Medida) (medidas[String(l.Tabela ?? '')] ??= []).push(String(l.Medida));\n  }\n  return [{\n    json: {\n      ok: true,\n      ...base,\n      tabelas: Object.fromEntries(Object.entries(tabelas).slice(0, 40).map(([t, cols]) => [t, cols.slice(0, 200)])),\n      ...(Object.keys(medidas).length ? { medidas } : { medidas: 'não disponíveis (use as colunas com SUM, COUNTROWS etc.)' }),\n      orientacao: 'Escreva a consulta DAX com esses nomes, por exemplo: EVALUATE TOPN(20, SUMMARIZECOLUMNS(Tabela[Coluna], \"Total\", [Medida]), [Total], DESC). Nomes com espaço ficam entre aspas simples: \\'Minha Tabela\\'[Coluna].',\n    },\n  }];\n}\n\nconst dados = linhas.slice(0, escolha.limite).map(limparChaves);\nreturn [{\n  json: {\n    ok: true,\n    ...base,\n    linhas: dados.length,\n    total_linhas: linhas.length,\n    ...(linhas.length > dados.length ? { cortado: `mostrando ${dados.length} de ${linhas.length} linhas` } : {}),\n    dados,\n  },\n}];\n" },
    position: [2640, 300],
  },
  output: [{ ok: true, tipo: 'consulta', modelo: 'Pedidos', area: 'Comercial', linhas: 1, total_linhas: 1, dados: [{ Cliente: 'A', Total: 10 }] }],
});

const explicarFalha = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Explicar falha',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Falha ao listar as áreas de trabalho do Power BI: quase sempre é a credencial.\nconst erro = $input.first().json.error ?? $input.first().json;\nconst texto = String(erro?.message ?? erro?.description ?? erro ?? '').slice(0, 300);\nlet orientacao = 'Explique ao dono, em uma frase, que o Power BI não respondeu agora e sugira tentar de novo em alguns minutos.';\nif (/401|403|unauthori[sz]ed|forbidden|credential|token|consent|invalid_grant/i.test(texto)) {\n  orientacao = 'Diga ao dono que a conexão com o Power BI precisa ser refeita: no n8n, em Credentials, abrir a credencial \"Power BI (Kira)\" e clicar em reconectar.';\n}\nreturn [{ json: { ok: false, erro: `Não consegui acessar o Power BI: ${texto || 'sem detalhe'}`, orientacao } }];\n" },
    position: [660, 520],
  },
  output: [{ ok: false, erro: 'Não consegui acessar o Power BI.', orientacao: 'Explique ao dono.' }],
});

export default workflow('kira-powerbi', 'Kira — Power BI (ferramenta)', {
  executionOrder: 'v1',
  timezone: 'America/Sao_Paulo',
  saveDataSuccessExecution: 'none',
  saveDataErrorExecution: 'all',
})
  .add(quandoConsultar)
  .to(
    soNoAmbiente
      .onTrue(
        listarAreas
          .to(areasDeTrabalho)
          .to(listarModelos)
          .to(listarRelatorios)
          .to(escolherModelo)
          .to(consultarModelo.onTrue(ultimaAtualizacao.to(executarDax).to(eEstrutura.onTrue(listarMedidas.to(montarResultado)).onFalse(montarResultado))).onFalse(montarResultado)),
      )
      .onFalse(foraDoAmbiente),
  )
  .add(listarAreas.onError(explicarFalha));
