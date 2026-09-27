// Kira — Teams: sub-workflow das ferramentas conversas_teams, ler_conversa_teams e
// enviar_mensagem_teams da Kira (Microsoft Graph, com a conta do dono).
// Ações: listar (conversas recentes, com filtro por nome), ler (mensagens de uma conversa)
// e enviar (mensagem numa conversa existente, em nome do dono, só quando ele pede).
import { workflow, node, trigger, switchCase, expr, newCredential } from '@n8n/workflow-sdk';

const credTeams = newCredential('Microsoft Teams account');

const quandoUsar = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: {
    name: 'Quando a Kira usar o Teams',
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'acao', type: 'string' },
          { name: 'busca', type: 'string' },
          { name: 'chat_id', type: 'string' },
          { name: 'texto', type: 'string' },
          { name: 'quantidade', type: 'number' },
        ],
      },
    },
    position: [0, 300],
  },
  output: [{ acao: 'listar', busca: '', chat_id: '', texto: '', quantidade: 10 }],
});

const qualAcao = switchCase({
  version: 3.4,
  config: {
    name: 'Qual ação?',
    parameters: {
      mode: 'rules',
      rules: {
        values: [
          {
            renameOutput: true,
            outputKey: 'Listar',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
              conditions: [{ id: 'acao-listar', leftValue: expr('{{ $json.acao }}'), rightValue: 'listar', operator: { type: 'string', operation: 'equals' } }],
              combinator: 'and',
            },
          },
          {
            renameOutput: true,
            outputKey: 'Ler',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
              conditions: [{ id: 'acao-ler', leftValue: expr('{{ $json.acao }}'), rightValue: 'ler', operator: { type: 'string', operation: 'equals' } }],
              combinator: 'and',
            },
          },
          {
            renameOutput: true,
            outputKey: 'Enviar',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
              conditions: [{ id: 'acao-enviar', leftValue: expr('{{ $json.acao }}'), rightValue: 'enviar', operator: { type: 'string', operation: 'equals' } }],
              combinator: 'and',
            },
          },
        ],
      },
      options: { fallbackOutput: 'extra', renameFallbackOutput: 'Outra' },
    },
    position: [220, 300],
  },
});

const buscarConversas = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Buscar conversas',
    parameters: {
      method: 'GET',
      url: 'https://graph.microsoft.com/v1.0/me/chats',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'microsoftTeamsOAuth2Api',
      sendQuery: true,
      specifyQuery: 'keypair',
      queryParameters: {
        parameters: [
          { name: '$expand', value: 'members,lastMessagePreview' },
          { name: '$top', value: '50' },
        ],
      },
      options: { timeout: 30000 },
    },
    credentials: { microsoftTeamsOAuth2Api: credTeams },
    onError: 'continueErrorOutput',
    position: [480, 100],
  },
  output: [{ value: [{ id: '19:abc@unq.gbl.spaces', chatType: 'oneOnOne', members: [{ userId: 'u1', displayName: 'João Silva' }], lastMessagePreview: { createdDateTime: '2026-09-27T12:00:00Z', body: { content: 'Oi' } } }] }],
});

const resumirConversas = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Resumir conversas',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Resume as conversas do Teams: com quem é, a última mensagem e quando (horário de Brasília).\n// Filtra pelo nome da pessoa ou do grupo (busca) e devolve as mais recentes primeiro.\nconst entrada = $('Quando a Kira usar o Teams').first().json;\nconst normalizar = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[^a-z0-9 ]/g, '').replace(/\\s+/g, ' ').trim();\nconst textoDe = (html) =>\n  String(html ?? '')\n    .replace(/<br\\s*\\/?>/gi, '\\n')\n    .replace(/<\\/p>/gi, '\\n')\n    .replace(/<[^>]+>/g, '')\n    .replace(/&nbsp;/g, ' ')\n    .replace(/&lt;/g, '<')\n    .replace(/&gt;/g, '>')\n    .replace(/&quot;/g, '\"')\n    .replace(/&#39;/g, \"'\")\n    .replace(/&amp;/g, '&')\n    .replace(/[ \\t]+\\n/g, '\\n')\n    .trim();\nconst quando = (iso) => (iso ? DateTime.fromISO(iso).setZone('America/Sao_Paulo').toFormat('dd/MM HH:mm') : '');\nconst TIPOS = { oneOnOne: 'individual', group: 'grupo', meeting: 'reunião' };\n\nconst chats = $input.first().json.value ?? [];\n// O dono aparece em todas as conversas: é o participante mais frequente.\nconst contagem = new Map();\nfor (const c of chats) for (const m of c.members ?? []) if (m.userId) contagem.set(m.userId, (contagem.get(m.userId) ?? 0) + 1);\nconst dono = chats.length > 1 ? [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] : null;\n\nconst busca = normalizar(entrada.busca);\nconst quantidade = Math.min(Math.max(Number(entrada.quantidade) || 10, 1), 30);\nconst conversas = chats\n  .map((c) => {\n    const todas = (c.members ?? []).filter((m) => m.userId !== dono).map((m) => m.displayName).filter(Boolean);\n    const pessoas = todas.length > 8 ? [...todas.slice(0, 8), `e mais ${todas.length - 8}`] : todas;\n    const ultima = c.lastMessagePreview ?? null;\n    return {\n      chat_id: c.id,\n      tipo: TIPOS[c.chatType] ?? c.chatType,\n      nome: c.topic || (todas.length > 4 ? `${todas.slice(0, 4).join(', ')} e mais ${todas.length - 4}` : todas.join(', ')) || '(sem nome)',\n      pessoas,\n      todas,\n      ultima_mensagem: ultima?.body\n        ? { de: ultima.from?.user?.displayName ?? '', quando: quando(ultima.createdDateTime), texto: textoDe(ultima.body.content).slice(0, 200) }\n        : null,\n      data: ultima?.createdDateTime ?? c.lastUpdatedDateTime ?? '',\n    };\n  })\n  .filter((c) => !busca || normalizar([c.nome, ...c.todas].join(' ')).includes(busca))\n  .sort((a, b) => String(b.data).localeCompare(String(a.data)));\n\nreturn [{ json: { total: conversas.length, conversas: conversas.slice(0, quantidade).map(({ data, todas, ...c }) => c) } }];\n" },
    position: [700, 100],
  },
  output: [{ total: 1, conversas: [{ chat_id: '19:abc@unq.gbl.spaces', tipo: 'individual', nome: 'João Silva', pessoas: ['João Silva'], ultima_mensagem: null }] }],
});

const buscarMensagens = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Buscar mensagens',
    parameters: {
      method: 'GET',
      url: expr("{{ 'https://graph.microsoft.com/v1.0/me/chats/' + encodeURIComponent(String($json.chat_id ?? '').trim()) + '/messages' }}"),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'microsoftTeamsOAuth2Api',
      sendQuery: true,
      specifyQuery: 'keypair',
      queryParameters: {
        parameters: [
          { name: '$top', value: expr('{{ Math.min(Math.max(Number($json.quantidade) || 15, 1), 50) }}') },
          { name: '$orderby', value: 'createdDateTime desc' },
        ],
      },
      options: { timeout: 30000 },
    },
    credentials: { microsoftTeamsOAuth2Api: credTeams },
    onError: 'continueErrorOutput',
    position: [480, 300],
  },
  output: [{ value: [{ messageType: 'message', createdDateTime: '2026-09-27T12:00:00Z', from: { user: { displayName: 'João Silva' } }, body: { contentType: 'html', content: '<p>Oi</p>' } }] }],
});

const resumirMensagens = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Resumir mensagens',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Resume as mensagens de uma conversa do Teams, da mais antiga para a mais nova.\nconst entrada = $('Quando a Kira usar o Teams').first().json;\nconst textoDe = (html) =>\n  String(html ?? '')\n    .replace(/<br\\s*\\/?>/gi, '\\n')\n    .replace(/<\\/p>/gi, '\\n')\n    .replace(/<[^>]+>/g, '')\n    .replace(/&nbsp;/g, ' ')\n    .replace(/&lt;/g, '<')\n    .replace(/&gt;/g, '>')\n    .replace(/&quot;/g, '\"')\n    .replace(/&#39;/g, \"'\")\n    .replace(/&amp;/g, '&')\n    .replace(/[ \\t]+\\n/g, '\\n')\n    .trim();\nconst quando = (iso) => (iso ? DateTime.fromISO(iso).setZone('America/Sao_Paulo').toFormat('dd/MM HH:mm') : '');\n\nconst mensagens = ($input.first().json.value ?? [])\n  .filter((m) => m.messageType === 'message' && !m.deletedDateTime)\n  .map((m) => ({\n    de: m.from?.user?.displayName ?? m.from?.application?.displayName ?? '',\n    quando: quando(m.createdDateTime),\n    texto: textoDe(m.body?.content).slice(0, 800),\n    anexos: (m.attachments ?? []).map((a) => a.name).filter(Boolean),\n  }))\n  .reverse();\n\nreturn [{ json: { chat_id: entrada.chat_id, total: mensagens.length, mensagens } }];\n" },
    position: [700, 300],
  },
  output: [{ chat_id: '19:abc@unq.gbl.spaces', total: 1, mensagens: [{ de: 'João Silva', quando: '27/09 09:00', texto: 'Oi', anexos: [] }] }],
});

const prepararEnvio = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Preparar envio',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Confere o pedido de envio e monta a mensagem (texto simples vira HTML seguro, com quebras de linha).\nconst entrada = $('Quando a Kira usar o Teams').first().json;\nconst chat = String(entrada.chat_id ?? '').trim();\nconst texto = String(entrada.texto ?? '').trim();\nif (!chat) throw new Error('Faltou o id da conversa: use conversas_teams para achar a conversa certa.');\nif (!texto) throw new Error('Faltou o texto da mensagem.');\nconst html = texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\\n/g, '<br>');\nreturn [{ json: { chat_id: chat, corpo: JSON.stringify({ body: { contentType: 'html', content: html } }) } }];\n" },
    onError: 'continueErrorOutput',
    position: [480, 500],
  },
  output: [{ chat_id: '19:abc@unq.gbl.spaces', corpo: '{"body":{"contentType":"html","content":"Oi"}}' }],
});

const enviarMensagem = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Enviar mensagem',
    parameters: {
      method: 'POST',
      url: expr("{{ 'https://graph.microsoft.com/v1.0/chats/' + encodeURIComponent($json.chat_id) + '/messages' }}"),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'microsoftTeamsOAuth2Api',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('{{ $json.corpo }}'),
      options: { timeout: 30000 },
    },
    credentials: { microsoftTeamsOAuth2Api: credTeams },
    onError: 'continueErrorOutput',
    position: [700, 500],
  },
  output: [{ id: '1790540000000', createdDateTime: '2026-09-27T20:00:00Z' }],
});

const mensagemEnviada = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Mensagem enviada',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'env-ok', name: 'ok', value: true, type: 'boolean' },
          { id: 'env-id', name: 'mensagem_id', value: expr('{{ $json.id }}'), type: 'string' },
          { id: 'env-quando', name: 'enviada_em', value: expr("{{ DateTime.fromISO($json.createdDateTime).setZone('America/Sao_Paulo').toFormat('dd/MM/yyyy HH:mm') }}"), type: 'string' },
          { id: 'env-msg', name: 'orientacao', value: 'Mensagem enviada no Teams. Confirme ao dono o que foi enviado e para quem.', type: 'string' },
        ],
      },
      options: {},
    },
    position: [920, 500],
  },
  output: [{ ok: true, mensagem_id: '1790540000000', enviada_em: '27/09/2026 17:00', orientacao: 'Mensagem enviada no Teams.' }],
});

const acaoInvalida = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Ação inválida',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'inv-ok', name: 'ok', value: false, type: 'boolean' },
          { id: 'inv-erro', name: 'erro', value: expr("{{ 'Ação desconhecida: ' + ($json.acao || '(vazia)') + '. Use listar, ler ou enviar.' }}"), type: 'string' },
        ],
      },
      options: {},
    },
    position: [480, 700],
  },
  output: [{ ok: false, erro: 'Ação desconhecida.' }],
});

const explicarFalha = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Explicar falha',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Resume o erro para a Kira explicar ao dono.\nconst item = $input.first().json;\nconst bruto = item.error ?? item;\nconst textos = [];\nconst coletar = (valor, profundidade = 0) => {\n  if (!valor || profundidade > 4) return;\n  if (typeof valor === 'string') {\n    textos.push(valor);\n    return;\n  }\n  if (typeof valor === 'object') {\n    for (const chave of ['message', 'description']) {\n      if (typeof valor[chave] === 'string') textos.push(valor[chave]);\n    }\n    coletar(valor.error, profundidade + 1);\n  }\n};\ncoletar(bruto);\nconst erro = [...new Set(textos.map((t) => t.trim()).filter(Boolean))].join(' — ').slice(0, 600) || 'erro desconhecido';\n\nreturn [{ json: { ok: false, erro, orientacao: 'Não deu certo no Teams. Explique o erro ao dono em poucas palavras; nada foi enviado.' } }];\n" },
    position: [920, 700],
  },
  output: [{ ok: false, erro: 'erro', orientacao: 'Explique o erro ao dono.' }],
});

export default workflow('kira-teams', 'Kira — Teams (ferramenta)', { executionOrder: 'v1', timezone: 'America/Sao_Paulo' })
  .add(quandoUsar)
  .to(
    qualAcao
      .onCase(0, buscarConversas.to(resumirConversas))
      .onCase(1, buscarMensagens.to(resumirMensagens))
      .onCase(2, prepararEnvio.to(enviarMensagem.to(mensagemEnviada)))
      .onCase(3, acaoInvalida),
  )
  .add(buscarConversas.onError(explicarFalha))
  .add(buscarMensagens.onError(explicarFalha))
  .add(prepararEnvio.onError(explicarFalha))
  .add(enviarMensagem.onError(explicarFalha));
