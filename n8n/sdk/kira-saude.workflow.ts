// Kira — Saúde: (1) quando a Kira ou uma automação dela falha, anota a falha na tabela kira_saude e avisa no
// Telegram (no máximo um aviso por dia para cada workflow); (2) toda segunda às 8h manda o resumo da semana: conexões,
// falhas, base de pedidos, último backup e quando reconectar o LinkedIn. Só lê os serviços; só escreve na kira_saude.
import { workflow, node, trigger, ifElse, expr, newCredential } from '@n8n/workflow-sdk';

const seFalhar = trigger({
  type: 'n8n-nodes-base.errorTrigger',
  version: 1,
  config: { name: 'Quando algo falhar', position: [0, 100] },
  output: [{ execution: { id: '1', url: 'https://n8n.exemplo.com/workflow/x/executions/1', lastNodeExecuted: 'Nó', error: { message: 'erro' }, mode: 'trigger' }, workflow: { id: 'x', name: 'Workflow' } }],
});

const segunda = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.2,
  config: {
    name: 'Segunda às 8h',
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 8 * * 1' }] } },
    position: [0, 400],
  },
  output: [{ timestamp: '2026-10-05T08:00:00.000-03:00' }],
});

const configuracao = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Configuração da saúde',
    parameters: {
      assignments: {
        assignments: [
          { id: 's-chat', name: 'chat_id', value: "", type: 'string' },
          { id: 's-fuso', name: 'fuso_horario', value: 'America/Sao_Paulo', type: 'string' },
          { id: 's-agora', name: 'agora', value: expr("{{ $now.toISO() }}"), type: 'string' },
          { id: 's-base', name: 'base_max_dias', value: 4, type: 'number' },
          { id: 's-backup', name: 'backup_max_dias', value: 8, type: 'number' },
          { id: 's-linkedin', name: 'linkedin_conectado_em', value: "", type: 'string' },
          { id: 's-linkedin-dias', name: 'linkedin_validade_dias', value: 60, type: 'number' },
          { id: 's-servicos', name: 'servicos', value: 'outlook, drive, gemini, powerbi, linkedin, pedidos', type: 'string' },
        ],
      },
      options: {},
    },
    position: [240, 250],
  },
  output: [{ chat_id: '111111111', fuso_horario: 'America/Sao_Paulo', linkedin_conectado_em: '2026-10-02' }],
});

const veioDeFalha = ifElse({
  version: 2.3,
  config: {
    name: 'Veio de uma falha?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          { id: 'c-falha', leftValue: expr("{{ $('Quando algo falhar').isExecuted }}"), rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } },
        ],
        combinator: 'and',
      },
      options: {},
    },
    position: [480, 250],
  },
});

const resumirFalha = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Resumir falha',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Resume a falha que o n8n avisou (Error Trigger) em poucos campos e monta o aviso do Telegram.\n// Vale para falha no meio de um workflow (execution) e para falha ao ligar um gatilho (trigger).\nconst dados = $('Quando algo falhar').first().json || {};\nconst execucao = dados.execution || {};\nconst gatilho = dados.trigger || {};\nconst wf = dados.workflow || {};\nconst erro = execucao.error || gatilho.error || {};\nconst esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\nconst corta = (s, n) => {\n  const t = String(s ?? '').replace(/\\s+/g, ' ').trim();\n  return t.length > n ? t.slice(0, n - 1) + '…' : t;\n};\nconst nome = corta(wf.name || 'Workflow sem nome', 120);\nconst no = corta(execucao.lastNodeExecuted || erro.node?.name || '', 120);\nconst mensagem = corta(erro.message || erro.description || 'erro sem mensagem', 300);\nconst link = /^https:\\/\\/[^\\s\"<>]+$/.test(String(execucao.url || '')) ? execucao.url : '';\n\n// Uma dica curta para os erros mais comuns (o dono não é técnico).\nlet dica = '';\nif (/\\b401\\b|unauthori[sz]ed|invalid_grant|expired|expirad|reconnect|reconect/i.test(mensagem)) {\n  dica = 'Parece que uma conexão venceu: no n8n, abra Credentials, escolha a conexão desse serviço e clique em Reconnect.';\n} else if (/\\b429\\b|quota|rate.?limit|resource.?exhausted|too many requests/i.test(mensagem)) {\n  dica = 'Limite de uso do serviço gratuito: costuma voltar sozinho em algumas horas.';\n} else if (/timeout|timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket hang up|\\b50[234]\\b/i.test(mensagem)) {\n  dica = 'Instabilidade na internet ou no serviço: costuma passar sozinha na próxima rodada.';\n}\n\nconst linhas = ['⚠️ <b>Kira: uma automação falhou</b>', `<b>${esc(nome)}</b>`];\nif (no) linhas.push(`Onde: <i>${esc(no)}</i>`);\nlinhas.push(`Erro: ${esc(mensagem)}`);\nif (dica) linhas.push(`💡 ${esc(dica)}`);\nif (link) linhas.push(`<a href=\"${esc(link)}\">Abrir a execução no n8n</a>`);\nlinhas.push('<i>Se ela falhar de novo hoje, eu só anoto, sem novo aviso. O resumo da semana chega na segunda.</i>');\n\nreturn [\n  {\n    json: {\n      workflow_id: String(wf.id ?? ''),\n      workflow: nome,\n      no,\n      erro: mensagem,\n      execucao_id: String(execucao.id ?? ''),\n      modo: String(execucao.mode || gatilho.mode || ''),\n      html: linhas.join('\\n'),\n    },\n  },\n];\n" },
    position: [720, 100],
  },
  output: [{ workflow_id: 'x', workflow: 'Workflow', no: 'Nó', erro: 'erro', execucao_id: '1', modo: 'trigger', html: 'aviso' }],
});

const jaAvisei = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Já avisei hoje?',
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'name', value: 'kira_saude' },
      matchType: 'allConditions',
      filters: {
        conditions: [
          { keyName: 'workflow_id', condition: 'eq', keyValue: expr("{{ $('Resumir falha').first().json.workflow_id }}") },
          { keyName: 'createdAt', condition: 'gte', keyValue: expr("{{ $now.setZone('America/Sao_Paulo').startOf('day').toISO() }}") },
        ],
      },
      returnAll: false,
      limit: 1,
    },
    alwaysOutputData: true,
    executeOnce: true,
    onError: 'continueRegularOutput',
    position: [960, 100],
  },
  output: [{}],
});

const anotar = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Anotar falha',
    parameters: {
      resource: 'row',
      operation: 'insert',
      dataTableId: { __rl: true, mode: 'name', value: 'kira_saude' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          workflow_id: expr("{{ $('Resumir falha').first().json.workflow_id }}"),
          workflow: expr("{{ $('Resumir falha').first().json.workflow }}"),
          no: expr("{{ $('Resumir falha').first().json.no }}"),
          erro: expr("{{ $('Resumir falha').first().json.erro }}"),
          execucao_id: expr("{{ $('Resumir falha').first().json.execucao_id }}"),
          modo: expr("{{ $('Resumir falha').first().json.modo }}"),
        },
        matchingColumns: [],
        schema: [
          { id: "workflow_id", displayName: "workflow_id", required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: "workflow", displayName: "workflow", required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: "no", displayName: "no", required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: "erro", displayName: "erro", required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: "execucao_id", displayName: "execucao_id", required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: "modo", displayName: "modo", required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
        ],
      },
      options: {},
    },
    executeOnce: true,
    onError: 'continueRegularOutput',
    position: [1200, 100],
  },
  output: [{ id: 1, workflow_id: 'x' }],
});

const primeiroAviso = ifElse({
  version: 2.3,
  config: {
    name: 'Primeiro aviso de hoje?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          { id: 'c-primeiro', leftValue: expr("{{ !$('Já avisei hoje?').first().json.id }}"), rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } },
        ],
        combinator: 'and',
      },
      options: {},
    },
    position: [1440, 100],
  },
});

const avisar = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Avisar no Telegram',
    parameters: {
      chatId: expr("{{ $('Configuração da saúde').first().json.chat_id }}"),
      text: expr("{{ $('Resumir falha').first().json.html }}"),
      additionalFields: { appendAttribution: false, disable_web_page_preview: true, parse_mode: 'HTML' },
    },
    credentials: { telegramApi: newCredential('Telegram') },
    onError: 'continueRegularOutput',
    position: [1680, 0],
  },
  output: [{ ok: true }],
});

// Conexões: uma leitura simples em cada serviço (uma falha vira um item de "Para olhar").
const outlook = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: "Outlook",
    parameters: {
      url: "https://graph.microsoft.com/v1.0/me",
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'microsoftOutlookOAuth2Api',
      sendQuery: true,
      queryParameters: { parameters: [
          { name: "$select", value: "id" },
      ] },
      options: { timeout: 30000 },
    },
    credentials: { microsoftOutlookOAuth2Api: newCredential('Microsoft Outlook') },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    executeOnce: true,
    position: [720, 400],
  },
  output: [{}],
});

const baseOneDrive = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: "Base de pedidos (OneDrive)",
    parameters: {
      url: "https://graph.microsoft.com/v1.0/me/drive/root:/Kira/base-pedidos.json",
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'microsoftTeamsOAuth2Api',
      sendQuery: true,
      queryParameters: { parameters: [
          { name: "$select", value: "lastModifiedDateTime,size" },
      ] },
      options: { timeout: 30000 },
    },
    credentials: { microsoftTeamsOAuth2Api: newCredential('Microsoft Teams account') },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    executeOnce: true,
    position: [960, 400],
  },
  output: [{}],
});

const drive = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: "Google Drive e último backup",
    parameters: {
      url: "https://www.googleapis.com/drive/v3/files",
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleDriveOAuth2Api',
      sendQuery: true,
      queryParameters: { parameters: [
          { name: "q", value: "name contains 'kira-backup-' and mimeType = 'application/json' and trashed = false" },
          { name: "orderBy", value: "createdTime desc" },
          { name: "pageSize", value: "1" },
          { name: "fields", value: "files(name,createdTime,size)" },
      ] },
      options: { timeout: 30000 },
    },
    credentials: { googleDriveOAuth2Api: newCredential('Google Drive') },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    executeOnce: true,
    position: [1200, 400],
  },
  output: [{}],
});

// O Power BI responde 403 com o acesso vencido; o Fabric responde 401 e o n8n renova a conexão sozinho.
const renovarPbi = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: "Renovar conexão (Power BI)",
    parameters: {
      url: "https://api.fabric.microsoft.com/v1/workspaces",
      authentication: 'genericCredentialType',
      genericAuthType: 'oAuth2Api',
      options: { timeout: 30000 },
    },
    credentials: { oAuth2Api: newCredential('Power BI') },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    executeOnce: true,
    position: [1440, 400],
  },
  output: [{}],
});

const powerBi = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: "Power BI",
    parameters: {
      url: "https://api.powerbi.com/v1.0/myorg/groups",
      authentication: 'genericCredentialType',
      genericAuthType: 'oAuth2Api',
      sendQuery: true,
      queryParameters: { parameters: [
          { name: "$top", value: "1" },
      ] },
      options: { timeout: 30000 },
    },
    credentials: { oAuth2Api: newCredential('Power BI') },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    executeOnce: true,
    position: [1680, 400],
  },
  output: [{}],
});

const gemini = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: "Gemini",
    parameters: {
      url: "https://generativelanguage.googleapis.com/v1beta/models",
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googlePalmApi',
      sendQuery: true,
      queryParameters: { parameters: [
          { name: "pageSize", value: "1" },
      ] },
      options: { timeout: 30000 },
    },
    credentials: { googlePalmApi: newCredential('Gemini (Google AI Studio)') },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    executeOnce: true,
    position: [1920, 400],
  },
  output: [{}],
});

const linkedin = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: "LinkedIn",
    parameters: {
      url: "https://api.linkedin.com/v2/userinfo",
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'linkedInOAuth2Api',
      options: { timeout: 30000 },
    },
    credentials: { linkedInOAuth2Api: newCredential('LinkedIn') },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    executeOnce: true,
    position: [2160, 400],
  },
  output: [{}],
});

const falhasSemana = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Falhas da semana',
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'name', value: 'kira_saude' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'createdAt', condition: 'gte', keyValue: expr("{{ $now.minus({ days: 7 }).toISO() }}") }] },
      returnAll: true,
    },
    alwaysOutputData: true,
    executeOnce: true,
    onError: 'continueRegularOutput',
    position: [2400, 400],
  },
  output: [{}],
});

const montarRelatorio = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar relatório',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Monta o resumo semanal da saúde da Kira (HTML do Telegram): conexões, falhas dos últimos 7 dias, base de pedidos,\n// último backup e quando reconectar o LinkedIn. Cada verificação que falhar vira um item de \"Para olhar\",\n// sem derrubar o resto.\nconst cfg = $('Configuração da saúde').first().json;\nconst fuso = cfg.fuso_horario || 'America/Sao_Paulo';\nconst agora = new Date(cfg.agora || Date.now());\nconst esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\nconst corta = (s, n) => {\n  const t = String(s ?? '').replace(/\\s+/g, ' ').trim();\n  return t.length > n ? t.slice(0, n - 1) + '…' : t;\n};\nconst resposta = (no) => {\n  try {\n    return $(no).first()?.json ?? {};\n  } catch (e) {\n    return { error: { message: 'não rodou' } };\n  }\n};\nconst falhou = (r) => Boolean(r.error);\nconst motivo = (r) => {\n  const m = corta(r.error?.message ?? r.error?.description ?? (typeof r.error === 'string' ? r.error : ''), 100) || 'sem resposta';\n  return /\\b401\\b|unauthori[sz]ed|invalid_grant|expired/i.test(m) ? `${m} (reconecte no n8n: Credentials → Reconnect)` : m;\n};\nconst valida = (iso) => {\n  const d = new Date(iso);\n  return isNaN(d) ? null : d;\n};\nconst diaMes = (d) => d.toLocaleDateString('pt-BR', { timeZone: fuso, day: '2-digit', month: '2-digit' });\nconst diaHora = (d) =>\n  d.toLocaleString('pt-BR', { timeZone: fuso, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(', ', ' às ');\nconst diasDesde = (d) => (agora - d) / 86400000;\nconst paraOlhar = [];\n// Só entram no resumo os serviços da lista \"servicos\" da configuração.\nconst usados = String(cfg.servicos ?? 'outlook, drive, gemini, powerbi, linkedin, pedidos').toLowerCase().split(/[\\s,;]+/).filter(Boolean);\nconst usa = (servico) => usados.includes(servico);\n\n// Conexões: uma leitura simples em cada serviço.\nconst conexoes = [\n  ['Outlook', 'Outlook', 'outlook'],\n  ['Google Drive', 'Google Drive e último backup', 'drive'],\n  ['Gemini', 'Gemini', 'gemini'],\n  ['Power BI', 'Power BI', 'powerbi'],\n  ['LinkedIn', 'LinkedIn', 'linkedin'],\n].filter((c) => usa(c[2]));\nlet conexoesOk = 0;\nconst marcas = conexoes.map(([rotulo, no]) => {\n  const r = resposta(no);\n  if (falhou(r)) {\n    paraOlhar.push(`${rotulo}: ${motivo(r)}`);\n    return `⚠️ ${rotulo}`;\n  }\n  conexoesOk += 1;\n  return `✅ ${rotulo}`;\n});\n\n// Falhas anotadas pelo aviso de falhas (execuções de teste não contam).\nlet falhas = null;\ntry {\n  const linhas = $('Falhas da semana').all().map((i) => i.json);\n  if (!linhas.some((r) => r && r.error)) falhas = linhas.filter((r) => r && r.id !== undefined && r.modo !== 'manual');\n} catch (e) {}\nconst grupos = new Map();\nfor (const f of falhas ?? []) {\n  const chave = f.workflow || f.workflow_id || 'Workflow sem nome';\n  const g = grupos.get(chave) ?? { nome: chave, total: 0, ultima: '', no: '' };\n  g.total += 1;\n  if (String(f.createdAt ?? '') >= g.ultima) {\n    g.ultima = String(f.createdAt ?? '');\n    g.no = f.no || '';\n  }\n  grupos.set(chave, g);\n}\nconst listaGrupos = [...grupos.values()].sort((a, b) => b.total - a.total || b.ultima.localeCompare(a.ultima));\nconst MAX = 6;\nconst linhaGrupo = (g) => {\n  const quando = valida(g.ultima);\n  const detalhes = [quando ? `última ${diaHora(quando)}` : '', g.no ? `em <i>${esc(corta(g.no, 50))}</i>` : ''].filter(Boolean).join(', ');\n  return `• ${esc(corta(g.nome, 60))}: ${g.total}${detalhes ? ` (${detalhes})` : ''}`;\n};\n\n// Base de pedidos: o arquivo que a sincronização grava no OneDrive.\nconst base = usa('pedidos') ? resposta('Base de pedidos (OneDrive)') : {};\nconst MAX_BASE = Number(cfg.base_max_dias) || 4;\nlet linhaBase = '';\nlet baseOk = usa('pedidos') ? false : null;\nconst dataBase = valida(base.lastModifiedDateTime);\nif (!usa('pedidos')) {\n  // sem a base de pedidos, a linha não aparece\n} else if (falhou(base)) {\n  linhaBase = '⚠️ não consegui conferir';\n  paraOlhar.push(`Base de pedidos: ${motivo(base)}`);\n} else if (!dataBase) {\n  linhaBase = '⚠️ arquivo não encontrado';\n  paraOlhar.push('Base de pedidos: o arquivo da base não apareceu no OneDrive');\n} else if (diasDesde(dataBase) > MAX_BASE) {\n  linhaBase = `⚠️ parada desde ${diaHora(dataBase)}`;\n  paraOlhar.push(`Base de pedidos: sem atualização há ${Math.floor(diasDesde(dataBase))} dias`);\n} else {\n  baseOk = true;\n  linhaBase = `✅ atualizada em ${diaHora(dataBase)}`;\n}\n\n// Último backup (a pasta do Google Drive).\nconst drive = usa('drive') ? resposta('Google Drive e último backup') : {};\nconst MAX_BACKUP = Number(cfg.backup_max_dias) || 8;\nconst ultimo = (drive.files ?? [])[0];\nconst dataBackup = valida(ultimo?.createdTime);\nlet linhaBackup = '';\nlet backupOk = usa('drive') ? false : null;\nif (!usa('drive')) {\n  // o backup fica no Google Drive: sem ele, a linha não aparece\n} else if (falhou(drive)) linhaBackup = '⚠️ não consegui conferir';\nelse if (!dataBackup) {\n  linhaBackup = '⚠️ nenhum backup ainda';\n  paraOlhar.push('Backup: nenhum arquivo na pasta de backups');\n} else {\n  const kb = Math.round((Number(ultimo.size) || 0) / 1024);\n  const tamanho = kb >= 1024 ? `${(kb / 1024).toFixed(1).replace('.', ',')} MB` : `${kb} KB`;\n  backupOk = diasDesde(dataBackup) <= MAX_BACKUP;\n  linhaBackup = `${backupOk ? '✅' : '⚠️'} ${diaHora(dataBackup)} (${tamanho})`;\n  if (!backupOk) paraOlhar.push(`Backup: o último tem ${Math.floor(diasDesde(dataBackup))} dias`);\n}\n\n// LinkedIn: o acesso dura 60 dias e não renova sozinho.\nlet linhaLinkedin = '';\nlet faltamLinkedin = null;\n// Conta em dias de calendário (data de hoje no fuso do dono contra a data do vencimento).\nconst conectado = valida(String(cfg.linkedin_conectado_em || '').slice(0, 10) + 'T12:00:00Z');\nif (usa('linkedin') && cfg.linkedin_conectado_em && conectado) {\n  const vence = new Date(conectado.getTime() + (Number(cfg.linkedin_validade_dias) || 60) * 86400000);\n  const hoje = new Date(agora.toLocaleDateString('en-CA', { timeZone: fuso }) + 'T12:00:00Z');\n  faltamLinkedin = Math.round((vence - hoje) / 86400000);\n  if (faltamLinkedin < 0) {\n    linhaLinkedin = `⚠️ a conexão venceu em ${diaMes(vence)}`;\n    paraOlhar.push('LinkedIn: reconecte no n8n (Credentials → LinkedIn → Reconnect) e anote a nova data na Configuração da saúde');\n  } else if (faltamLinkedin <= 10) {\n    linhaLinkedin = `⚠️ reconectar até ${diaMes(vence)} (faltam ${faltamLinkedin} dias)`;\n    paraOlhar.push('LinkedIn: reconecte no n8n (Credentials → LinkedIn → Reconnect) e anote a nova data na Configuração da saúde');\n  } else linhaLinkedin = `reconectar até ${diaMes(vence)} (faltam ${faltamLinkedin} dias)`;\n}\n\nconst partes = [`🩺 <b>Saúde da Kira</b> — semana até ${diaMes(agora)}`, '', `<b>Conexões:</b> ${marcas.join(' · ')}`, ''];\nif (falhas === null) {\n  partes.push('<b>Falhas nos últimos 7 dias:</b> ?');\n  paraOlhar.push('Falhas: não consegui ler a tabela kira_saude');\n} else if (!falhas.length) partes.push('<b>Falhas nos últimos 7 dias:</b> nenhuma 🎉');\nelse {\n  partes.push(`<b>Falhas nos últimos 7 dias:</b> ${falhas.length}`);\n  partes.push(listaGrupos.slice(0, MAX).map(linhaGrupo).join('\\n') + (listaGrupos.length > MAX ? `\\n…e mais ${listaGrupos.length - MAX}` : ''));\n}\npartes.push('');\nif (linhaBase) partes.push(`<b>Base de pedidos:</b> ${linhaBase}`);\nif (linhaBackup) partes.push(`<b>Último backup:</b> ${linhaBackup}`);\nif (linhaLinkedin) partes.push(`<b>LinkedIn:</b> ${linhaLinkedin}`);\npartes.push('');\nif (paraOlhar.length) partes.push('👀 <b>Para olhar:</b>\\n' + paraOlhar.map((p) => `• ${esc(p)}`).join('\\n'));\nelse partes.push('Tudo certo por aqui. 💪');\n\nconst html = partes.join('\\n').replace(/\\n{3,}/g, '\\n\\n').trim();\nconst texto_simples = esc(html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));\nreturn [\n  {\n    json: {\n      html,\n      texto_simples,\n      contagens: {\n        conexoes_ok: conexoesOk,\n        conexoes_com_problema: conexoes.length - conexoesOk,\n        falhas_7_dias: falhas === null ? null : falhas.length,\n        workflows_com_falha: falhas === null ? null : listaGrupos.length,\n        base_ok: baseOk,\n        backup_ok: backupOk,\n        linkedin_faltam_dias: faltamLinkedin,\n        itens_para_olhar: paraOlhar.length,\n      },\n    },\n  },\n];\n" },
    position: [2640, 400],
  },
  output: [{ html: 'Saúde da Kira', texto_simples: 'Saúde da Kira', contagens: {} }],
});

const enviarRelatorio = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Enviar relatório',
    parameters: {
      chatId: expr("{{ $('Configuração da saúde').first().json.chat_id }}"),
      text: expr("{{ $json.html }}"),
      additionalFields: { appendAttribution: false, disable_web_page_preview: true, parse_mode: 'HTML' },
    },
    credentials: { telegramApi: newCredential('Telegram') },
    onError: 'continueErrorOutput',
    position: [2880, 400],
  },
  output: [{ ok: true }],
});

const enviarSimples = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Enviar sem formatação',
    parameters: {
      chatId: expr("{{ $('Configuração da saúde').first().json.chat_id }}"),
      text: expr("{{ $('Montar relatório').first().json.texto_simples }}"),
      additionalFields: { appendAttribution: false, disable_web_page_preview: true, parse_mode: 'HTML' },
    },
    credentials: { telegramApi: newCredential('Telegram') },
    onError: 'continueRegularOutput',
    position: [3120, 580],
  },
  output: [{ ok: true }],
});

const conferencia = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Conferência (só números)',
    parameters: {
      assignments: {
        assignments: [
          { id: 'c-cont', name: 'contagens', value: expr("{{ $('Montar relatório').first().json.contagens }}"), type: 'object' },
        ],
      },
      options: {},
    },
    position: [3120, 400],
  },
  output: [{ contagens: {} }],
});

// Guarda só os últimos 90 dias de falhas (e tira as anotações de teste).
const limpar = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Limpar falhas antigas',
    parameters: {
      resource: 'row',
      operation: 'deleteRows',
      dataTableId: { __rl: true, mode: 'name', value: 'kira_saude' },
      matchType: 'anyCondition',
      filters: {
        conditions: [
          { keyName: 'createdAt', condition: 'lt', keyValue: expr("{{ $now.minus({ days: 90 }).toISO() }}") },
          { keyName: 'modo', condition: 'eq', keyValue: 'manual' },
        ],
      },
      options: {},
    },
    executeOnce: true,
    onError: 'continueRegularOutput',
    position: [3360, 400],
  },
  output: [{ id: 1 }],
});

export default workflow('kira-saude', 'Kira — Saúde (avisos e resumo de segunda)', { executionOrder: 'v1', timezone: 'America/Sao_Paulo' })
  .add(seFalhar)
  .to(configuracao)
  .add(segunda)
  .to(configuracao)
  .to(
    veioDeFalha
      .onTrue(resumirFalha.to(jaAvisei).to(anotar).to(primeiroAviso.onTrue(avisar)))
      .onFalse(
        outlook
          .to(baseOneDrive)
          .to(drive)
          .to(renovarPbi)
          .to(powerBi)
          .to(gemini)
          .to(linkedin)
          .to(falhasSemana)
          .to(montarRelatorio)
          .to(enviarRelatorio)
          .to(conferencia)
          .to(limpar),
      ),
  )
  .add(enviarRelatorio.onError(enviarSimples))
  .add(enviarSimples)
  .to(conferencia);
