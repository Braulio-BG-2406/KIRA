// Kira — Fim do Dia: de segunda a sexta, às 18h, manda no Telegram o resumo do fim do expediente: agenda do
// próximo dia útil, e-mails críticos que ele ainda não respondeu, tarefas abertas do ambiente de trabalho e pedidos
// atrasados. Só lê: não envia e-mail nem muda nada. Cada parte que falhar vira um aviso, sem travar as outras.
import { workflow, node, trigger, expr, newCredential } from '@n8n/workflow-sdk';

const quando = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.2,
  config: {
    name: 'Seg a sex às 18h',
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 18 * * 1-5' }] } },
    position: [0, 300],
  },
  output: [{ timestamp: '2026-10-02T18:00:00.000-03:00' }],
});

const configuracao = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Configuração do fim do dia',
    parameters: {
      assignments: {
        assignments: [
          { id: 'f-nome', name: 'nome_dono', value: "Seu nome", type: 'string' },
          { id: 'f-chat', name: 'chat_id', value: "", type: 'string' },
          { id: 'f-user', name: 'user_id', value: "", type: 'string' },
          { id: 'f-amb', name: 'ambiente', value: "TRABALHO", type: 'string' },
          { id: 'f-amb-nome', name: 'ambiente_nome', value: "Trabalho", type: 'string' },
          { id: 'f-fuso', name: 'fuso_horario', value: 'America/Sao_Paulo', type: 'string' },
          { id: 'f-max', name: 'max_itens', value: 8, type: 'number' },
          { id: 'f-remetentes', name: 'remetentes_criticos', value: "", type: 'string' },
          { id: 'f-palavras', name: 'palavras_criticas', value: "", type: 'string' },
          { id: 'f-hoje', name: 'hoje', value: expr("{{ $now.setZone('America/Sao_Paulo').toFormat('yyyy-MM-dd') }}"), type: 'string' },
          { id: 'f-hoje-ext', name: 'hoje_extenso', value: expr("{{ $now.setZone('America/Sao_Paulo').setLocale('pt-BR').toFormat('cccc, dd/MM') }}"), type: 'string' },
          { id: 'f-janela', name: 'inicio_janela_utc', value: expr("{{ (() => { let d = $now.setZone('America/Sao_Paulo').startOf('day'); let dias = 2; while (dias > 0) { d = d.minus({ days: 1 }); if (d.weekday <= 5) dias--; } return d.toUTC().toISO({ suppressMilliseconds: true }); })() }}"), type: 'string' },
          {
            id: 'f-prox',
            name: 'proximo_dia',
            value: expr("{{ (() => { const d = $now.setZone('America/Sao_Paulo').startOf('day'); return d.plus({ days: d.weekday === 5 ? 3 : d.weekday === 6 ? 2 : 1 }).toISO({ suppressMilliseconds: true }); })() }}"),
            type: 'string',
          },
          {
            id: 'f-prox-rotulo',
            name: 'proximo_dia_rotulo',
            value: expr("{{ (() => { const d = $now.setZone('America/Sao_Paulo').startOf('day'); const mais = d.weekday === 5 ? 3 : d.weekday === 6 ? 2 : 1; const t = d.plus({ days: mais }).setLocale('pt-BR').toFormat('cccc, dd/MM'); return mais === 1 ? 'Amanhã, ' + t : t.charAt(0).toUpperCase() + t.slice(1); })() }}"),
            type: 'string',
          },
        ],
      },
      options: {},
    },
    position: [220, 300],
  },
  output: [{ nome_dono: 'Carlos', chat_id: '111111111', user_id: '111111111', ambiente: 'TRABALHO', ambiente_nome: 'Trabalho', hoje: '2026-10-02', proximo_dia: '2026-10-05T00:00:00-03:00' }],
});

const quemSouEu = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: "Quem sou eu",
    parameters: {
      url: "https://graph.microsoft.com/v1.0/me",
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'microsoftOutlookOAuth2Api',
      sendQuery: true,
      queryParameters: { parameters: [
          { name: "$select", value: "mail,userPrincipalName" },
      ] },
      options: { timeout: 30000 },
    },
    credentials: { microsoftOutlookOAuth2Api: newCredential('Microsoft Outlook') },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    executeOnce: true,
    position: [440, 300],
  },
  output: [{ value: [] }],
});

const emailsRecebidos = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: "E-mails recebidos",
    parameters: {
      url: "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages",
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'microsoftOutlookOAuth2Api',
      sendQuery: true,
      queryParameters: { parameters: [
          { name: "$filter", value: expr("{{ 'receivedDateTime ge ' + $('Configuração do fim do dia').first().json.inicio_janela_utc }}") },
          { name: "$orderby", value: "receivedDateTime desc" },
          { name: "$top", value: "200" },
          { name: "$select", value: "id,subject,bodyPreview,from,sender,toRecipients,receivedDateTime,importance,flag,conversationId,inferenceClassification" },
          { name: "$expand", value: "singleValueExtendedProperties($filter=id eq 'Integer 0x1081')" },
      ] },
      options: { timeout: 30000 },
    },
    credentials: { microsoftOutlookOAuth2Api: newCredential('Microsoft Outlook') },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    executeOnce: true,
    position: [660, 300],
  },
  output: [{ value: [] }],
});

const emailsEnviados = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: "E-mails enviados",
    parameters: {
      url: "https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages",
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'microsoftOutlookOAuth2Api',
      sendQuery: true,
      queryParameters: { parameters: [
          { name: "$filter", value: expr("{{ 'sentDateTime ge ' + $('Configuração do fim do dia').first().json.inicio_janela_utc }}") },
          { name: "$orderby", value: "sentDateTime desc" },
          { name: "$top", value: "200" },
          { name: "$select", value: "conversationId,sentDateTime" },
      ] },
      options: { timeout: 30000 },
    },
    credentials: { microsoftOutlookOAuth2Api: newCredential('Microsoft Outlook') },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    executeOnce: true,
    position: [880, 300],
  },
  output: [{ value: [] }],
});

const agenda = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: "Agenda do próximo dia útil",
    parameters: {
      url: "https://graph.microsoft.com/v1.0/me/calendarView",
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'microsoftOutlookOAuth2Api',
      sendQuery: true,
      queryParameters: { parameters: [
          { name: "startDateTime", value: expr("{{ $('Configuração do fim do dia').first().json.proximo_dia }}") },
          { name: "endDateTime", value: expr("{{ DateTime.fromISO($('Configuração do fim do dia').first().json.proximo_dia).plus({ days: 1 }).toISO() }}") },
          { name: "$orderby", value: "start/dateTime" },
          { name: "$top", value: "30" },
          { name: "$select", value: "subject,start,end,location,isAllDay,isCancelled" },
      ] },
      sendHeaders: true,
      headerParameters: { parameters: [
          { name: "Prefer", value: "outlook.timezone=\"E. South America Standard Time\"" },
      ] },
      options: { timeout: 30000 },
    },
    credentials: { microsoftOutlookOAuth2Api: newCredential('Microsoft Outlook') },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    executeOnce: true,
    position: [1100, 300],
  },
  output: [{ value: [] }],
});

const tarefas = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Tarefas abertas',
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'name', value: 'kira_tarefas' },
      matchType: 'allConditions',
      filters: {
        conditions: [
          { keyName: 'user_id', condition: 'eq', keyValue: expr("{{ $('Configuração do fim do dia').first().json.user_id }}") },
          { keyName: 'contexto', condition: 'eq', keyValue: expr("{{ $('Configuração do fim do dia').first().json.ambiente }}") },
          { keyName: 'status', condition: 'eq', keyValue: 'aberta' },
        ],
      },
      returnAll: true,
    },
    alwaysOutputData: true,
    executeOnce: true,
    onError: 'continueRegularOutput',
    position: [1320, 300],
  },
  output: [{ id: 1, titulo: 'Enviar proposta', prazo: '2026-10-02', status: 'aberta' }],
});

const pedidos = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Pedidos atrasados',
    parameters: {
      workflowId: { __rl: true, mode: 'id', value: "" },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: { busca: '', tipo: 'atrasados', limite: 1 },
        matchingColumns: [],
        schema: [
          { id: 'busca', displayName: 'busca', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'tipo', displayName: 'tipo', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' },
          { id: 'limite', displayName: 'limite', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'number' },
        ],
        attemptToConvertTypes: false,
        convertFieldsToString: false,
      },
      mode: 'once',
      options: { waitForSubWorkflow: true },
    },
    executeOnce: true,
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    position: [1540, 300],
  },
  output: [{ resumo: { itens: 0, pedidos: 0 } }],
});

const montar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar mensagem',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Monta a mensagem do fim do dia (HTML do Telegram): agenda do próximo dia útil, e-mails críticos sem resposta,\n// tarefas abertas do ambiente de trabalho e pedidos atrasados. Uma parte que falhar vira um aviso curto, sem derrubar\n// o resto.\nconst cfg = $('Configuração do fim do dia').first().json;\nconst esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\nconst corta = (s, n) => {\n  const t = String(s ?? '').replace(/\\s+/g, ' ').trim();\n  return t.length > n ? t.slice(0, n - 1) + '…' : t;\n};\nconst resposta = (no) => {\n  try {\n    return $(no).first()?.json ?? {};\n  } catch (e) {\n    return { error: { message: 'não rodou' } };\n  }\n};\nconst falhou = (r) => Boolean(r.error);\nconst motivo = (r) => corta(r.error?.message ?? r.error?.description ?? (typeof r.error === 'string' ? r.error : ''), 120);\nconst avisos = [];\nconst MAX = Math.min(Math.max(Number(cfg.max_itens) || 8, 1), 15);\nconst lista = (itens, linha) => itens.slice(0, MAX).map(linha).join('\\n') + (itens.length > MAX ? `\\n…e mais ${itens.length - MAX}` : '');\n\n// Agenda do próximo dia útil (o Outlook devolve o horário já no fuso do Brasil).\nconst agenda = resposta('Agenda do próximo dia útil');\nconst eventos = falhou(agenda) ? [] : (agenda.value ?? []).filter((e) => e && !e.isCancelled);\nif (falhou(agenda)) avisos.push(`agenda (${motivo(agenda)})`);\nconst hora = (dt) => String(dt ?? '').slice(11, 16);\nconst dataCurta = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;\nconst alvo = String(cfg.proximo_dia ?? '').slice(0, 10);\n// Compromisso de vários dias (férias, viagem...) aparece como \"dia todo (até dd/mm)\", sem um horário que confunda.\nconst ultimoDia = (e) => {\n  const fim = String(e.end?.dateTime ?? '');\n  if (!e.isAllDay && fim.slice(11, 16) !== '00:00') return fim.slice(0, 10);\n  const d = new Date(fim.slice(0, 10) + 'T12:00:00Z');\n  if (isNaN(d)) return fim.slice(0, 10);\n  d.setUTCDate(d.getUTCDate() - 1);\n  return d.toISOString().slice(0, 10);\n};\nconst linhaEvento = (e) => {\n  const ultimo = ultimoDia(e);\n  const variosDias = Boolean(alvo) && (String(e.start?.dateTime ?? '').slice(0, 10) < alvo || ultimo > alvo);\n  const quando =\n    e.isAllDay || variosDias ? (alvo && ultimo > alvo ? `dia todo (até ${dataCurta(ultimo)})` : 'dia todo') : `${hora(e.start?.dateTime)}–${hora(e.end?.dateTime)}`;\n  const local = e.location?.displayName ? ` (${esc(corta(e.location.displayName, 40))})` : '';\n  return `• ${quando} ${esc(corta(e.subject || '(sem assunto)', 70))}${local}`;\n};\n\n// E-mails críticos que ele ainda não respondeu (de hoje e dos 2 dias úteis anteriores). Fica de fora o que ele já\n// respondeu ou encaminhou (pela marca do Outlook ou por um e-mail dele na mesma conversa, de qualquer aparelho), os\n// automáticos, os que o Outlook separou em \"Outros\" e os em que ele está só em cópia. Sem IA: crítico é o que tem\n// alta prioridade, está sinalizado, vem de um remetente importante ou fala de urgência, prazo, problema ou pedido.\nconst eu = resposta('Quem sou eu');\nconst meuEmail = String(eu.mail || eu.userPrincipalName || '').trim().toLowerCase();\nconst emails = resposta('E-mails recebidos');\nconst enviados = resposta('E-mails enviados');\nconst criticos = [];\nlet outrosSemResposta = 0;\nconst normalizar = (s) =>\n  String(s ?? '')\n    .toLowerCase()\n    .normalize('NFD')\n    .replace(/\\p{M}/gu, '')\n    .replace(/\\s+/g, ' ')\n    .trim();\nconst listaDaConfig = (s) =>\n  String(s ?? '')\n    .split(/[,;\\n]/)\n    .map(normalizar)\n    .filter(Boolean);\nif (falhou(emails)) avisos.push(`e-mails (${motivo(emails)})`);\nelse {\n  // Conversas em que ele mandou e-mail depois de receber: contam como respondidas.\n  const ultimoEnvio = new Map();\n  if (falhou(enviados)) avisos.push(`e-mails enviados (${motivo(enviados)})`);\n  else\n    for (const s of enviados.value ?? []) {\n      const conversa = String(s?.conversationId ?? '');\n      const quando = String(s?.sentDateTime ?? '');\n      if (conversa && quando > (ultimoEnvio.get(conversa) ?? '')) ultimoEnvio.set(conversa, quando);\n    }\n  // Remetentes automáticos: pelo começo do endereço ou por uma parte do domínio (ex.: avisos@notificacoes.loja.com).\n  const AUTOMATICO = /^(no-?reply|nao-?responda|naoresponda|do-?not-?reply|mailer-daemon|postmaster|bounce|notifica|notification|alerta?s?|newsletter|news|marketing|info@|mkt|xml@|nfe@)/;\n  const DOMINIO_AUTOMATICO = /@(.+[.-])?(notifica[a-z]*|notifications?|newsletters?|news|mailer|marketing|mkt|bounces?)[.-]/;\n  const ASSUNTO_AUTOMATICO = /^(resposta automatica|automatic reply|auto-?reply|out of office|fora do escritorio|ausencia|aceito:|recusado:|provisorio:|accepted:|declined:|tentative:|convite:|invitation:|updated invitation|convite atualizado|cancelado:|canceled:|entrega nao realizada|undeliverable|mail delivery)/;\n  const SINAIS = [\n    ['urgente', /\\b(urgente|urgencia|urgent|emergencia|critic[oa]|imediat[oa]|imediatamente|asap|o quanto antes|com prioridade|prioritari[oa])\\b/],\n    ['prazo', /\\b(atrasad[oa]s?|atraso|vencid[oa]s?|vence hoje|ate hoje|ainda hoje|prazo (final|de hoje|vencido|esgotado)|ultimo aviso|ultima chamada)\\b/],\n    ['problema', /\\b(reclamac(ao|oes)|insatisfeit[oa]s?|multa|cancelamento|parad[oa]|nao funciona|falha grave|devoluc(ao|oes)|juridico|extrajudicial|processo judicial)\\b/],\n    ['aguarda retorno', /\\b(aguardo (o )?(seu|sua) (retorno|resposta|aprovacao)|aguardando (o )?(seu |sua )?(retorno|resposta|aprovacao)|pendente de aprovacao|preciso de (uma )?resposta|favor (retornar|responder)|sem retorno)\\b/],\n    ['pedido', /\\b(pedidos?|trf|transferencias?|cotac(ao|oes)|orcamentos?|solicitac(ao|oes) de compras?|ordens? de compra|ordens? de producao|faturamento|nota fiscal|previsao de entrega|prazo de entrega|status do pedido)\\b|\\b(op|oc|sc|nf|nfe|nf-e)\\s*(n[o°º]?\\.?\\s*)?:?\\s*\\d{3,}/],\n  ];\n  const REMETENTES = listaDaConfig(cfg.remetentes_criticos);\n  const PALAVRAS = listaDaConfig(cfg.palavras_criticas);\n  const endereco = (r) => String(r?.emailAddress?.address ?? '').trim().toLowerCase();\n  for (const m of emails.value ?? []) {\n    if (/eventMessage/i.test(String(m['@odata.type'] ?? ''))) continue;\n    const de = endereco(m.from) || endereco(m.sender);\n    if (!de || (meuEmail && de === meuEmail) || AUTOMATICO.test(de) || DOMINIO_AUTOMATICO.test(de)) continue;\n    // Na Caixa de Entrada Destaques, o que o Outlook separou em \"Outros\" (propaganda, avisos) não conta.\n    if (m.inferenceClassification === 'other') continue;\n    const assunto = normalizar(m.subject).replace(/^((re|res|fw|fwd|enc|rv|tr)\\s*:\\s*)+/, '');\n    if (ASSUNTO_AUTOMATICO.test(assunto)) continue;\n    const verbo = (m.singleValueExtendedProperties ?? []).find((p) => /0x1081/i.test(String(p.id)));\n    if (verbo && ['102', '103', '104'].includes(String(verbo.value))) continue;\n    if (m.conversationId && (ultimoEnvio.get(String(m.conversationId)) ?? '') > String(m.receivedDateTime ?? '')) continue;\n    const para = (m.toRecipients ?? []).map(endereco);\n    if (meuEmail && para.length && !para.includes(meuEmail)) continue;\n\n    const texto = `${assunto}\\n${normalizar(m.bodyPreview)}`;\n    const motivos = [];\n    if (m.importance === 'high') motivos.push('alta prioridade');\n    if (m.flag?.flagStatus === 'flagged') motivos.push('sinalizado');\n    if (REMETENTES.some((r) => (r.includes('@') && !r.startsWith('@') ? de === r : de.endsWith(r.startsWith('@') ? r : '@' + r)))) motivos.push('remetente importante');\n    for (const [nome, regra] of SINAIS) if (regra.test(texto)) motivos.push(nome);\n    if (PALAVRAS.some((p) => texto.includes(p))) motivos.push('palavra-chave');\n    if (motivos.length) criticos.push({ ...m, motivos });\n    else outrosSemResposta++;\n  }\n  // Os com mais sinais primeiro; no empate, quem espera há mais tempo.\n  criticos.sort((a, b) => b.motivos.length - a.motivos.length || String(a.receivedDateTime).localeCompare(String(b.receivedDateTime)));\n}\nconst fuso = cfg.fuso_horario || 'America/Sao_Paulo';\nconst quandoRecebeu = (iso) => {\n  const d = new Date(iso);\n  if (isNaN(d)) return '';\n  const hora = d.toLocaleTimeString('pt-BR', { timeZone: fuso, hour: '2-digit', minute: '2-digit' });\n  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: fuso }).format(d);\n  return dia === cfg.hoje ? hora : `${dataCurta(dia)} ${hora}`;\n};\nconst linhaEmail = (m) =>\n  `• ${quandoRecebeu(m.receivedDateTime)} ${esc(corta(m.from?.emailAddress?.name || m.from?.emailAddress?.address || '', 30))}: ` +\n  `${esc(corta(m.subject || '(sem assunto)', 60))} <i>(${esc(m.motivos.join(', '))})</i>`;\nconst blocoEmails =\n  `🚨 <b>E-mails críticos sem resposta: ${falhou(emails) ? '?' : criticos.length}</b>` +\n  (falhou(emails) ? '' : criticos.length ? `\\n${lista(criticos, linhaEmail)}` : '\\nNenhum e-mail crítico esperando você. 👍') +\n  (outrosSemResposta ? `\\n<i>Outros ${outrosSemResposta} sem resposta não parecem críticos.</i>` : '');\n\n// Tarefas abertas, só do ambiente de trabalho (sem misturar ambientes).\nlet tarefas = [];\ntry {\n  tarefas = $('Tarefas abertas')\n    .all()\n    .map((i) => i.json)\n    .filter((t) => t && t.titulo);\n} catch (e) {\n  avisos.push('tarefas');\n}\ntarefas.sort((a, b) => String(a.prazo || '9999').localeCompare(String(b.prazo || '9999')));\nconst linhaTarefa = (t) => {\n  const prazo = /^\\d{4}-\\d{2}-\\d{2}/.test(String(t.prazo || '')) ? String(t.prazo).slice(0, 10) : '';\n  const marca = !prazo ? '' : prazo < cfg.hoje ? ` ⚠️ atrasada (${dataCurta(prazo)})` : prazo === cfg.hoje ? ' (vence hoje)' : ` (até ${dataCurta(prazo)})`;\n  return `• ${esc(corta(t.titulo, 70))}${marca}`;\n};\n\n// Pedidos atrasados (base oficial de pedidos), em números.\nconst pedidos = resposta('Pedidos atrasados');\nlet blocoPedidos = '';\nif (falhou(pedidos) || !pedidos.resumo) avisos.push(`pedidos (${motivo(pedidos) || corta(pedidos.erro, 120) || 'sem resposta da base'})`);\nelse {\n  const r = pedidos.resumo;\n  const unidades = (r.por_unidade ?? [])\n    .slice(0, 4)\n    .map((u) => `${esc(corta(u.valor, 25))}: ${u.itens}`)\n    .join(' · ');\n  blocoPedidos = r.itens\n    ? `📦 <b>Pedidos atrasados: ${r.itens} ${r.itens === 1 ? 'item' : 'itens'}</b> em ${r.pedidos} ${r.pedidos === 1 ? 'pedido' : 'pedidos'}` +\n      (unidades ? `\\n${unidades}` : '')\n    : '📦 <b>Pedidos atrasados:</b> nenhum';\n  const atualizada = /atualizada em (.+)$/.exec(String(pedidos.fonte ?? ''))?.[1];\n  if (atualizada) blocoPedidos += `\\n<i>Base de ${esc(atualizada)}</i>`;\n}\n\nconst partes = [\n  `🌙 <b>Fim do dia, ${esc(cfg.nome_dono)}!</b> ${esc(cfg.hoje_extenso)}`,\n  `📅 <b>${esc(cfg.proximo_dia_rotulo)}</b>\\n` + (falhou(agenda) ? 'Não consegui ler a agenda.' : eventos.length ? lista(eventos, linhaEvento) : 'Nada na agenda.'),\n  blocoEmails,\n  `✅ <b>Tarefas abertas (${esc(cfg.ambiente_nome)}): ${tarefas.length}</b>` + (tarefas.length ? `\\n${lista(tarefas, linhaTarefa)}` : ''),\n  blocoPedidos,\n  avisos.length ? `⚠️ <i>Não consegui ler: ${esc(avisos.join('; '))}.</i>` : '',\n  'Bom descanso! 😊',\n].filter(Boolean);\nconst html = partes.join('\\n\\n');\nreturn [\n  {\n    json: {\n      html,\n      texto_simples: html.replace(/<[^>]+>/g, ''),\n      contagens: {\n        eventos: eventos.length,\n        emails_criticos: falhou(emails) ? null : criticos.length,\n        emails_sem_resposta: falhou(emails) ? null : criticos.length + outrosSemResposta,\n        tarefas: tarefas.length,\n        pedidos_atrasados: pedidos?.resumo?.itens ?? null,\n      },\n      avisos,\n    },\n  },\n];\n" },
    position: [1760, 300],
  },
  output: [{ html: 'Fim do dia', texto_simples: 'Fim do dia', contagens: {}, avisos: [] }],
});

const enviar = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Enviar fim do dia',
    parameters: {
      chatId: expr("{{ $('Configuração do fim do dia').first().json.chat_id }}"),
      text: expr("{{ $json.html }}"),
      additionalFields: { appendAttribution: false, disable_web_page_preview: true, parse_mode: 'HTML' },
    },
    credentials: { telegramApi: newCredential('Telegram') },
    onError: 'continueErrorOutput',
    position: [1980, 300],
  },
  output: [{ ok: true, result: { message_id: 1 } }],
});

const enviarSimples = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Enviar sem formatação',
    parameters: {
      chatId: expr("{{ $('Configuração do fim do dia').first().json.chat_id }}"),
      text: expr("{{ $('Montar mensagem').first().json.texto_simples }}"),
      additionalFields: { appendAttribution: false, disable_web_page_preview: true, parse_mode: 'HTML' },
    },
    credentials: { telegramApi: newCredential('Telegram') },
    onError: 'continueRegularOutput',
    position: [2200, 480],
  },
  output: [{ ok: true, result: { message_id: 2 } }],
});

const conferencia = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Conferência (só números)',
    parameters: {
      assignments: {
        assignments: [
          { id: 'c-cont', name: 'contagens', value: expr("{{ $('Montar mensagem').first().json.contagens }}"), type: 'object' },
          { id: 'c-avisos', name: 'avisos', value: expr("{{ $('Montar mensagem').first().json.avisos }}"), type: 'array' },
        ],
      },
      options: {},
    },
    position: [2200, 300],
  },
  output: [{ contagens: {}, avisos: [] }],
});

export default workflow('kira-fim-do-dia', 'Kira — Fim do Dia (18h)', { executionOrder: 'v1', timezone: 'America/Sao_Paulo' })
  .add(quando)
  .to(configuracao)
  .to(quemSouEu)
  .to(emailsRecebidos)
  .to(emailsEnviados)
  .to(agenda)
  .to(tarefas)
  .to(pedidos)
  .to(montar)
  .to(enviar)
  .to(conferencia)
  .add(enviar.onError(enviarSimples))
  .add(enviarSimples)
  .to(conferencia);
