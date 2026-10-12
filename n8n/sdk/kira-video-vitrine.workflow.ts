// Kira — vídeo vitrine: sub-workflow chamado pela ferramenta "video_vitrine" da Kira.
// Junta de 1 a 3 fotos do dono (Foto #N que ele mandou ou Imagem #N gerada, tabela kira_imagens) com a música de
// fundo que ele mandou (Música #N, tabela kira_musicas) num vídeo vertical 720x1280 para Reels. Quem monta o vídeo é
// o serviço de vídeo da VPS (vps/video, rota /vitrine, com ffmpeg): grátis, sem IA. O vídeo vai para o Telegram do
// dono e fica guardado como Vídeo #N (tabela kira_videos), pronto para virar um Reels pela ferramenta instagram.
import { workflow, node, trigger, ifElse, expr, newCredential } from '@n8n/workflow-sdk';

const credTelegram = newCredential('Telegram account');

const pedidoDaKira = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: {
    name: 'Pedido da Kira',
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: { values: [{ name: 'user_id', type: 'string' }, { name: 'chat_id', type: 'string' }, { name: 'fotos', type: 'string' }, { name: 'musica', type: 'number' }, { name: 'duracao', type: 'number' }] },
    },
    position: [0, 300],
  },
  output: [{ user_id: '111111111', chat_id: '111111111', fotos: '12, 13', musica: 0, duracao: 10 }],
});

const validarPedido = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Validar pedido', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Confere o pedido do vídeo vitrine: de 1 a 3 fotos (números da Foto #N ou Imagem #N), a música e a duração.\nconst MAX_FOTOS = 3;\nconst e = $input.first().json;\nconst texto = (v) => String(v ?? '').trim();\nconst fotos = [...new Set((texto(e.fotos).match(/\\d+/g) || []).map(Number).filter((n) => n > 0))];\nconst duracao = Math.min(20, Math.max(6, Math.round(Number(e.duracao) || 10)));\nconst pedido = {\n  user_id: texto(e.user_id),\n  chat_id: texto(e.chat_id),\n  fotos,\n  musica: Math.max(0, Math.floor(Number(e.musica) || 0)),\n  duracao,\n};\nlet mensagem = '';\nif (!pedido.user_id || !pedido.chat_id) mensagem = 'Não consegui identificar o dono.';\nelse if (!fotos.length) mensagem = 'Diga quais fotos usar (o número da Foto #N ou da Imagem #N), de 1 a 3.';\nelse if (fotos.length > MAX_FOTOS) mensagem = `O vídeo vitrine usa no máximo ${MAX_FOTOS} fotos. Escolha até ${MAX_FOTOS}.`;\nreturn [{ json: { ...pedido, ok: !mensagem, mensagem } }];\n" }, position: [220, 300] },
  output: [{ ok: true }],
});

const pedidoOk = ifElse({
  version: 2.3,
  config: {
    name: 'Pedido certo?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: 'pedido-ok', leftValue: expr('{{ $json.ok === true }}'), rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
      },
      options: {},
    },
    position: [440, 300],
  },
});

const buscarFotos = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Buscar fotos',
    parameters: {
      resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'name', value: 'kira_imagens' }, matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'user_id', condition: 'eq', keyValue: expr("{{ $('Validar pedido').first().json.user_id }}") }] },
      returnAll: true,
    },
    alwaysOutputData: true,
    executeOnce: true,
    position: [660, 200],
  },
  output: [{ id: 12, file_id: 'AgACAgEAAx' }],
});

const buscarMusicas = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Buscar músicas',
    parameters: {
      resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'name', value: 'kira_musicas' }, matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'user_id', condition: 'eq', keyValue: expr("{{ $('Validar pedido').first().json.user_id }}") }] },
      returnAll: true,
    },
    alwaysOutputData: true,
    executeOnce: true,
    position: [880, 200],
  },
  output: [{ id: 1, file_id: 'CQACAgEAAx', titulo: 'música' }],
});

const separarArquivos = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Separar arquivos', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Escolhe os arquivos do vídeo: as fotos pedidas (só as do próprio dono, na ordem pedida) e a música (a pedida\n// ou, se veio 0, a última que ele mandou). Devolve um item por arquivo, com o campo do formulário.\nconst pedido = $('Validar pedido').first().json;\nconst imagens = $('Buscar fotos').all().map((i) => i.json).filter((r) => r && r.id);\nconst musicas = $('Buscar músicas').all().map((i) => i.json).filter((r) => r && r.id && r.file_id);\nconst porId = new Map(imagens.map((r) => [Number(r.id), r]));\nconst faltando = pedido.fotos.filter((n) => !String(porId.get(n)?.file_id ?? '').trim());\nif (faltando.length) {\n  return [{ json: { ok: false, mensagem: `Não encontrei a foto #${faltando.join(', #')} (ou ela não chegou a ser guardada). Confira o número.` } }];\n}\nlet musica = null;\nif (pedido.musica) {\n  musica = musicas.find((m) => Number(m.id) === pedido.musica) || null;\n  if (!musica) return [{ json: { ok: false, mensagem: `Não encontrei a música #${pedido.musica}. Ele pode mandar o arquivo de áudio com a legenda \"música\".` } }];\n} else if (musicas.length) {\n  musica = musicas.reduce((a, b) => (Number(b.id) > Number(a.id) ? b : a));\n}\nif (musica && Number(musica.tamanho) > 20 * 1024 * 1024) {\n  return [{ json: { ok: false, mensagem: `A música #${musica.id} passa de 20 MB e o robô do Telegram não consegue baixar. Peça um arquivo menor.` } }];\n}\nconst comum = { ok: true, fotos: pedido.fotos, musica_id: musica ? Number(musica.id) : 0, musica_titulo: musica?.titulo ?? '', duracao: pedido.duracao };\nconst itens = pedido.fotos.map((n, i) => ({ json: { ...comum, campo: `foto${i + 1}`, file_id: porId.get(n).file_id } }));\nif (musica) itens.push({ json: { ...comum, campo: 'musica', file_id: musica.file_id } });\nreturn itens;\n" }, position: [1100, 200] },
  output: [{ ok: true, campo: 'foto1', file_id: 'AgACAgEAAx' }],
});

const arquivosOk = ifElse({
  version: 2.3,
  config: {
    name: 'Arquivos certos?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: 'arquivos-ok', leftValue: expr('{{ $json.ok === true }}'), rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
        combinator: 'and',
      },
      options: {},
    },
    position: [1320, 200],
  },
});

const avisar = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Avisar',
    parameters: {
      resource: 'message', operation: 'sendMessage', chatId: expr("{{ $('Validar pedido').first().json.chat_id }}"),
      text: expr("{{ '⏳ Estou montando o vídeo vitrine (' + $('Validar pedido').first().json.fotos.length + (($('Validar pedido').first().json.fotos.length > 1) ? ' fotos' : ' foto') + ($json.musica_id ? ', com a música #' + $json.musica_id : ', sem música') + '). Leva uns 2 minutos; o vídeo chega aqui. Não precisa pedir de novo.' }}"),
      additionalFields: { appendAttribution: false },
    },
    credentials: { telegramApi: credTelegram },
    executeOnce: true,
    onError: 'continueRegularOutput',
    position: [1540, 40],
  },
  output: [{ ok: true }],
});

const baixarArquivos = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Baixar arquivos',
    parameters: { resource: 'file', operation: 'get', fileId: expr('{{ $json.file_id }}'), download: true, additionalFields: {} },
    credentials: { telegramApi: credTelegram },
    onError: 'continueRegularOutput',
    position: [1540, 200],
  },
  output: [{ ok: true, result: { file_path: 'photos/file_1.jpg' } }],
});

const montarFormulario = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Montar formulário', parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Junta as fotos e a música baixadas do Telegram num formulário multipart (foto1, foto2, foto3, musica) para o\n// serviço de vídeo da VPS. Cada arquivo baixado chega na mesma ordem dos pedidos do \"Separar arquivos\"; se algum\n// não baixou, para tudo e diz qual, para o vídeo não sair com a foto errada.\nconst itens = $input.all();\nconst campos = $('Separar arquivos').all().map((i) => i.json);\nconst nomes = { foto1: 'a 1ª foto', foto2: 'a 2ª foto', foto3: 'a 3ª foto', musica: 'a música' };\nconst fronteira = 'kira' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);\nconst partes = [];\nfor (let i = 0; i < campos.length; i++) {\n  const campo = campos[i].campo;\n  if (!itens[i]?.binary?.data) throw new Error(`Não consegui baixar ${nomes[campo] || campo} do Telegram`);\n  const dados = await this.helpers.getBinaryDataBuffer(i, 'data');\n  const tipo = itens[i].binary.data.mimeType || 'application/octet-stream';\n  partes.push(Buffer.from(`--${fronteira}\\r\\nContent-Disposition: form-data; name=\"${campo}\"; filename=\"${campo}\"\\r\\nContent-Type: ${tipo}\\r\\n\\r\\n`));\n  partes.push(dados);\n  partes.push(Buffer.from('\\r\\n'));\n}\npartes.push(Buffer.from(`--${fronteira}--\\r\\n`));\nconst corpo = Buffer.concat(partes);\nconst { campo, file_id, ...pedido } = campos[0];\nreturn [\n  {\n    json: pedido,\n    binary: { data: { data: corpo.toString('base64'), mimeType: `multipart/form-data; boundary=${fronteira}`, fileName: 'formulario' } },\n  },\n];\n" }, onError: 'continueErrorOutput', position: [1760, 200] },
  output: [{ ok: true }],
});

const montarVitrine = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Montar vídeo vitrine',
    parameters: {
      method: 'POST',
      url: 'http://kira-video:8080/vitrine',
      sendQuery: true,
      queryParameters: { parameters: [{ name: 'duracao', value: expr('{{ $json.duracao }}') }] },
      sendBody: true,
      contentType: 'binaryData',
      inputDataFieldName: 'data',
      options: { timeout: 300000, response: { response: { responseFormat: 'file', outputPropertyName: 'data' } } },
    },
    onError: 'continueErrorOutput',
    position: [1980, 200],
  },
  output: [{}],
});

const mandarVideo = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Mandar vídeo',
    parameters: {
      resource: 'message', operation: 'sendVideo', chatId: expr("{{ $('Validar pedido').first().json.chat_id }}"),
      binaryData: true, binaryPropertyName: 'data',
      additionalFields: { caption: expr("{{ '🎬 Vídeo vitrine (foto #' + $('Validar pedido').first().json.fotos.join(', #') + ($('Montar formulário').first().json.musica_id ? '; música #' + $('Montar formulário').first().json.musica_id : '; sem música') + ').' }}") },
    },
    credentials: { telegramApi: credTelegram },
    onError: 'continueErrorOutput',
    position: [2200, 200],
  },
  output: [{ ok: true, result: { video: { file_id: 'BAACAgEAAx', duration: 10, width: 720, height: 1280, file_size: 1500000 } } }],
});

const guardarVideo = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Guardar vídeo',
    parameters: {
      resource: 'row', operation: 'insert', dataTableId: { __rl: true, mode: 'name', value: 'kira_videos' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          user_id: expr("{{ $('Validar pedido').first().json.user_id }}"),
          chat_id: expr("{{ $('Validar pedido').first().json.chat_id }}"),
          file_id: expr("{{ $json.result?.video?.file_id ?? $json.result?.document?.file_id ?? '' }}"),
          duracao: expr('{{ $json.result?.video?.duration ?? 0 }}'),
          tamanho: expr('{{ $json.result?.video?.file_size ?? 0 }}'),
          largura: expr('{{ $json.result?.video?.width ?? 720 }}'),
          altura: expr('{{ $json.result?.video?.height ?? 1280 }}'),
          mime: 'video/mp4',
          legenda: expr("{{ 'vitrine: foto #' + $('Validar pedido').first().json.fotos.join(', #') }}"),
        },
        matchingColumns: [],
        schema: [
          { id: 'user_id', displayName: 'user_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'chat_id', displayName: 'chat_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'file_id', displayName: 'file_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'duracao', displayName: 'duracao', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'tamanho', displayName: 'tamanho', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'largura', displayName: 'largura', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'altura', displayName: 'altura', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'mime', displayName: 'mime', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'legenda', displayName: 'legenda', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
        ],
      },
      options: {},
    },
    executeOnce: true,
    position: [2420, 200],
  },
  output: [{ id: 5 }],
});

const videoPronto = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Vídeo pronto',
    parameters: {
      mode: 'manual', includeOtherFields: false, options: {},
      assignments: { assignments: [
        { id: 'vp-0', name: 'ok', value: true, type: 'boolean' },
        { id: 'vp-1', name: 'video_id', value: expr('{{ $json.id }}'), type: 'number' },
        { id: 'vp-2', name: 'mensagem', type: 'string', value: expr("{{ 'Vídeo #' + $json.id + ' (vitrine) pronto e já enviado no Telegram, com a foto #' + $('Validar pedido').first().json.fotos.join(', #') + ($('Montar formulário').first().json.musica_id ? ' e a música #' + $('Montar formulário').first().json.musica_id : ', sem música (ele ainda não mandou nenhuma)') + '. Diga o número do vídeo e ofereça fazer o Reels com ele (ferramenta instagram, video_id ' + $json.id + ').' }}") },
      ] },
    },
    position: [2640, 200],
  },
  output: [{ ok: true, mensagem: '' }],
});

const naoDeu = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Não deu certo',
    parameters: {
      mode: 'manual', includeOtherFields: false, options: {},
      assignments: { assignments: [
        { id: 'nd-0', name: 'ok', value: false, type: 'boolean' },
        { id: 'nd-1', name: 'mensagem', type: 'string', value: expr("{{ $json.mensagem || ('Não consegui montar o vídeo vitrine (' + String($json.error?.description ?? $json.error?.message ?? $json.error ?? 'erro desconhecido').replace(/\\s*\\[line \\d+\\]/g, '').replace(/\\s+/g, ' ').slice(0, 200) + '). Diga isso em uma frase.') }}") },
      ] },
    },
    position: [1760, 460],
  },
  output: [{ ok: false, mensagem: '' }],
});

export default workflow('kira-video-vitrine', 'Kira — Vídeo vitrine (ferramenta)', {
  executionOrder: 'v1',
  timezone: 'America/Sao_Paulo',
  callerPolicy: 'workflowsFromSameOwner',
  saveDataSuccessExecution: 'none',
  saveDataErrorExecution: 'all',
  saveManualExecutions: false,
})
  .add(pedidoDaKira)
  .to(validarPedido)
  .to(pedidoOk.onTrue(buscarFotos.to(buscarMusicas.to(separarArquivos.to(arquivosOk.onTrue(avisar).onFalse(naoDeu))))).onFalse(naoDeu))
  .add(arquivosOk.onTrue(baixarArquivos.to(montarFormulario.to(montarVitrine.to(mandarVideo.to(guardarVideo.to(videoPronto)))))))
  .add(montarFormulario.onError(naoDeu))
  .add(montarVitrine.onError(naoDeu))
  .add(mandarVideo.onError(naoDeu));
