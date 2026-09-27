// Kira — pedidos: sub-workflow da ferramenta consultar_pedidos da Kira.
// Baixa do SharePoint (Microsoft Graph, conta do Teams) a planilha de pedidos exportada todo dia
// pelo ERP, lê as linhas e devolve só o que interessa à pergunta (e a data de atualização).
import { workflow, node, trigger, newCredential } from '@n8n/workflow-sdk';

const credTeams = newCredential('Microsoft Teams account');
const ARQUIVO = 'https://graph.microsoft.com/v1.0/drives/ID_DO_DRIVE/items/ID_DO_ARQUIVO';

const quandoConsultar = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: {
    name: 'Quando a Kira consultar os pedidos',
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'busca', type: 'string' },
          { name: 'tipo', type: 'string' },
          { name: 'limite', type: 'number' },
        ],
      },
    },
    position: [0, 300],
  },
  output: [{ busca: '12345', tipo: 'pedido', limite: 10 }],
});

const informacoesArquivo = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Informações do arquivo',
    parameters: {
      method: 'GET',
      url: ARQUIVO,
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'microsoftTeamsOAuth2Api',
      sendQuery: true,
      specifyQuery: 'keypair',
      queryParameters: { parameters: [{ name: '$select', value: 'name,size,lastModifiedDateTime' }] },
      options: { timeout: 30000 },
    },
    credentials: { microsoftTeamsOAuth2Api: credTeams },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    position: [220, 300],
  },
  output: [{ name: 'pedidos.xlsx', size: 95000, lastModifiedDateTime: '2026-09-27T13:44:04Z' }],
});

const baixarPlanilha = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Baixar planilha',
    parameters: {
      method: 'GET',
      url: ARQUIVO + '/content',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'microsoftTeamsOAuth2Api',
      options: { timeout: 60000, response: { response: { responseFormat: 'file', outputPropertyName: 'data' } } },
    },
    credentials: { microsoftTeamsOAuth2Api: credTeams },
    onError: 'continueErrorOutput',
    position: [440, 300],
  },
  output: [{}],
});

const lerPlanilha = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: {
    name: 'Ler planilha',
    parameters: { operation: 'xlsx', binaryPropertyName: 'data', options: { headerRow: true } },
    onError: 'continueErrorOutput',
    position: [660, 300],
  },
  output: [{ CD_PEDIDO: 1001, SEQUENCIA: 1, CLIENTE_FANTASIA: 'Cliente', DESC_MATERIAL: 'Material', SITUACAO_PEDIDO: 'Aberto' }],
});

const consultarPlanilha = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Consultar planilha',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Consulta a planilha de pedidos do ERP: procura por número (pedido, OC, NF, OP, solicitação,\n// material, cliente) ou por texto (cliente, material, fornecedor...) e devolve só os campos úteis.\n// tipo: pedido (padrão), atrasados, compra, solicitacao, producao ou resumo.\nconst entrada = $('Quando a Kira consultar os pedidos').first().json;\nconst arquivo = $('Informações do arquivo').first()?.json ?? {};\nconst linhas = $input.all().map((i) => i.json);\n\nconst normalizar = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[^a-z0-9 ./-]/g, '').replace(/\\s+/g, ' ').trim();\nconst vazio = (v) => v === undefined || v === null || String(v).trim() === '';\nconst texto = (v) => (vazio(v) ? '' : String(v).trim());\nfunction data(v) {\n  if (vazio(v)) return '';\n  const n = Number(v);\n  if (Number.isFinite(n) && n > 20000 && n < 80000) {\n    return DateTime.fromMillis(Math.round((n - 25569) * 86400000), { zone: 'UTC' }).toFormat('dd/MM/yyyy');\n  }\n  return texto(v);\n}\nconst numero = (v) => {\n  const n = Number(String(v ?? '').replace(',', '.'));\n  return Number.isFinite(n) ? n : null;\n};\nconst atrasado = (l) => {\n  const n = numero(l.ATRASO);\n  if (n !== null) return n > 0;\n  return /^(s|sim|atrasad)/i.test(texto(l.ATRASO));\n};\n\nconst CODIGOS = ['CD_PEDIDO', 'CD_ORDEM_COMPRA', 'NF', 'ULTIMA_NF_FATURADA', 'OP', 'CD_ORDEM', 'CD_SOLICITACAO', 'CD_MATERIAL', 'CD_CLIENTE', 'PARTNUMBER', 'NF_ENTRADA', 'PROJETO'];\nconst TEXTOS = ['CLIENTE_FANTASIA', 'CLIENTE_NOME_COMPLETO', 'DESC_MATERIAL', 'PARTNUMBER', 'NOME_FORNECEDOR_OC', 'FORNECEDOR_NF_ENTRADA', 'DESC_UNIDADE_NEGOCIO', 'MUNICIPIO', 'UF', 'VENDEDOR_INTERNO_NOME', 'VENDEDOR_EXTERNO_NOME', 'OBSERVACAO', 'PROJETO', 'DESC_GRUPO', 'NOME_FABRICANTE', 'AREA'];\n\nconst termos = normalizar(entrada.busca).split(' ').filter(Boolean);\nconst tipo = normalizar(entrada.tipo) || 'pedido';\nconst limite = Math.min(Math.max(Number(entrada.limite) || 10, 1), 25);\n\nconst combina = (l) =>\n  termos.every((t) =>\n    /^\\d+$/.test(t)\n      ? CODIGOS.some((c) => normalizar(l[c]).replace(/\\.0+$/, '') === t)\n      : TEXTOS.some((c) => normalizar(l[c]).includes(t)),\n  );\nconst FILTROS = {\n  atrasados: atrasado,\n  compra: (l) => !vazio(l.CD_ORDEM),\n  solicitacao: (l) => !vazio(l.CD_SOLICITACAO),\n  producao: (l) => !vazio(l.OP) || !vazio(l.DEM_OP_CD_MAT),\n};\nconst achadas = linhas.filter((l) => (!termos.length || combina(l)) && (!FILTROS[tipo] || FILTROS[tipo](l)));\n\nconst contar = (lista, campo) =>\n  Object.entries(lista.reduce((acc, l) => ((acc[texto(l[campo]) || '(vazio)'] = (acc[texto(l[campo]) || '(vazio)'] ?? 0) + 1), acc), {}))\n    .sort((a, b) => b[1] - a[1])\n    .slice(0, 10)\n    .map(([valor, itens]) => ({ valor, itens }));\nconst semVazios = (obj) =>\n  Object.fromEntries(\n    Object.entries(obj)\n      .map(([k, v]) => [k, v && typeof v === 'object' && !Array.isArray(v) ? semVazios(v) : v])\n      .filter(([, v]) => !(vazio(v) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length))),\n  );\nconst item = (l) =>\n  semVazios({\n    pedido: texto(l.CD_PEDIDO),\n    item: texto(l.SEQUENCIA),\n    emissao: data(l.DATA_EMISSAO),\n    unidade: texto(l.DESC_UNIDADE_NEGOCIO),\n    tipo_venda: texto(l.TIPO_VENDA),\n    cliente: texto(l.CLIENTE_FANTASIA) || texto(l.CLIENTE_NOME_COMPLETO),\n    cidade: [texto(l.MUNICIPIO), texto(l.UF)].filter(Boolean).join('/'),\n    vendedor: texto(l.VENDEDOR_INTERNO_NOME) || texto(l.VENDEDOR_EXTERNO_NOME),\n    material: [texto(l.CD_MATERIAL), texto(l.DESC_MATERIAL)].filter(Boolean).join(' - '),\n    partnumber: texto(l.PARTNUMBER),\n    quantidade: texto(l.QUANTIDADE),\n    preco_unitario: texto(l.PR_UNITARIO),\n    valor_total: texto(l.VL_TOTAL_ITEM),\n    prazo_entrega: data(l.PRAZO_ENTREGA_ITEM),\n    prazo_programado: data(l.PRAZO_PROGRAMADO_ITEM),\n    situacao: texto(l.SITUACAO_PEDIDO),\n    controle: texto(l.DESC_CONTROLE_PEDIDO),\n    controle_item: texto(l.ITEM_DESC_CONTROLE),\n    atraso: texto(l.ATRASO),\n    area: texto(l.AREA),\n    estoque_disponivel: texto(l.ESTOQUE_DISPONIVEL_ALM),\n    estoque_em_transito: texto(l.ESTOQUE_FISICO_EM_TRANSITO),\n    ordem_de_compra_cliente: texto(l.CD_ORDEM_COMPRA),\n    nf: texto(l.NF) || texto(l.ULTIMA_NF_FATURADA),\n    op: texto(l.OP),\n    compra: {\n      ordem: texto(l.CD_ORDEM),\n      fornecedor: texto(l.NOME_FORNECEDOR_OC),\n      quantidade: texto(l.QUANTIDADE_OC),\n      situacao: texto(l.SITUACAO_ITEM_ORDEM),\n      controle: texto(l.DESC_CONTROLE_ITEM_ORDEM),\n      previsao_entrega: data(l.PREVISAO_ENTREGA_ITEM_ORDEM),\n    },\n    solicitacao: {\n      numero: texto(l.CD_SOLICITACAO),\n      data: data(l.DATA_SOLICITACAO),\n      quantidade: texto(l.QUANTIDADE_ITEM_SOLICITACAO),\n      controle: texto(l.DESC_CONTROLE_ITEM_SOLICITACAO),\n    },\n    wms: { status: texto(l.STATUS_WMS), situacao: texto(l.SITUACAO_WMS) },\n    producao: {\n      material: [texto(l.DEM_OP_CD_MAT), texto(l.DEM_OP_DESCRICAO)].filter(Boolean).join(' - '),\n      necessaria: texto(l.DEM_OP_QT_NECESSARIA),\n      atendida: texto(l.DEM_OP_QT_ATENDIDA),\n      status_wms: texto(l.DEM_OP_STATUS_WMS),\n    },\n    observacao: texto(l.OBSERVACAO).slice(0, 200),\n  });\n\nconst atualizadoEm = arquivo.lastModifiedDateTime\n  ? DateTime.fromISO(arquivo.lastModifiedDateTime).setZone('America/Sao_Paulo').toFormat(\"dd/MM/yyyy 'às' HH:mm\")\n  : '';\nconst fonte = `Planilha ${arquivo.name || 'de pedidos'} do ERP${atualizadoEm ? `, atualizada em ${atualizadoEm}` : ''}`;\nconst resumo = {\n  itens: achadas.length,\n  pedidos: new Set(achadas.map((l) => texto(l.CD_PEDIDO))).size,\n  itens_atrasados: achadas.filter(atrasado).length,\n  por_situacao: contar(achadas, 'SITUACAO_PEDIDO'),\n  por_controle: contar(achadas, 'DESC_CONTROLE_PEDIDO'),\n};\n\nreturn [\n  {\n    json: {\n      fonte,\n      busca: texto(entrada.busca),\n      tipo,\n      resumo,\n      itens: tipo === 'resumo' ? [] : achadas.slice(0, limite).map(item),\n      mais_itens: Math.max(achadas.length - limite, 0),\n      orientacao: achadas.length\n        ? 'Responda só com estes dados e cite a fonte e a data de atualização. Não invente nada que não esteja aqui.'\n        : 'Nada encontrado. Diga isso ao dono, cite a fonte e a data de atualização e sugira buscar por outro número ou nome.',\n    },\n  },\n];\n" },
    position: [880, 300],
  },
  output: [{ fonte: 'Planilha pedidos.xlsx, atualizada em 27/09/2026 às 10:44', busca: '1001', tipo: 'pedido', resumo: { itens: 1, pedidos: 1 }, itens: [], mais_itens: 0 }],
});

const explicarFalha = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Explicar falha',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Resume o erro para a Kira explicar ao dono.\nconst item = $input.first().json;\nconst bruto = item.error ?? item;\nconst textos = [];\nconst coletar = (valor, profundidade = 0) => {\n  if (!valor || profundidade > 4) return;\n  if (typeof valor === 'string') {\n    textos.push(valor);\n    return;\n  }\n  if (typeof valor === 'object') {\n    for (const chave of ['message', 'description']) {\n      if (typeof valor[chave] === 'string') textos.push(valor[chave]);\n    }\n    coletar(valor.error, profundidade + 1);\n  }\n};\ncoletar(bruto);\nconst erro = [...new Set(textos.map((t) => t.trim()).filter(Boolean))].join(' — ').slice(0, 600) || 'erro desconhecido';\n\nreturn [{ json: { ok: false, erro, orientacao: 'Não consegui ler a planilha de pedidos. Explique o erro ao dono em poucas palavras e não invente dados.' } }];\n" },
    position: [660, 500],
  },
  output: [{ ok: false, erro: 'erro', orientacao: 'Explique o erro ao dono.' }],
});

export default workflow('kira-pedidos', 'Kira — pedidos (ferramenta)', { executionOrder: 'v1', timezone: 'America/Sao_Paulo' })
  .add(quandoConsultar)
  .to(informacoesArquivo)
  .to(baixarPlanilha)
  .to(lerPlanilha)
  .to(consultarPlanilha)
  .add(baixarPlanilha.onError(explicarFalha))
  .add(lerPlanilha.onError(explicarFalha));
