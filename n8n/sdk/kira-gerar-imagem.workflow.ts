// Kira — gerar imagem: sub-workflow chamado pela ferramenta "gerar_imagem" da Kira.
// Gera a imagem com o Gemini (modelos "Nano Banana"), manda no Telegram do dono e guarda
// a referência (file_id do Telegram) na tabela kira_imagens, para usar depois no LinkedIn e no Outlook.
// Com imagem_base (o número de uma foto que o dono mandou ou de uma imagem já gerada), a imagem
// original vai junto para o Gemini e o pedido vira uma edição dela, com a peça mantida igual.
import { workflow, node, trigger, ifElse, expr, newCredential } from '@n8n/workflow-sdk';

const credTelegram = newCredential('Telegram account');
const credGemini = newCredential('Google Gemini(PaLM) Api account');

const quandoPedir = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: {
    name: 'Quando a Kira pedir uma imagem',
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'descricao', type: 'string' },
          { name: 'legenda', type: 'string' },
          { name: 'formato', type: 'string' },
          { name: 'chat_id', type: 'string' },
          { name: 'user_id', type: 'string' },
          { name: 'modelo', type: 'string' },
          { name: 'imagem_base', type: 'number' },
        ],
      },
    },
    position: [0, 300],
  },
  output: [{ descricao: 'Ilustração minimalista de um farol ao pôr do sol', legenda: 'Farol', formato: 'quadrado', chat_id: '111111111', user_id: '111111111', modelo: '', imagem_base: 0 }],
});

const prepararPedido = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Preparar pedido',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Prepara o pedido de imagem ao Gemini: confere a descrição, escolhe o formato e o modelo.\n// Modelos de imagem do Gemini (\"Nano Banana\"): o principal e um reserva, usado se o principal falhar.\n// Com imagem_base (o número de uma foto do dono ou de uma imagem já gerada), o pedido vira uma edição dessa imagem.\nconst MODELO_PRINCIPAL = 'gemini-3.1-flash-image';\nconst MODELO_RESERVA = 'gemini-2.5-flash-image';\n\nconst FORMATOS = {\n  quadrado: '1:1', quadrada: '1:1', feed: '1:1',\n  retrato: '4:5', vertical: '4:5',\n  story: '9:16', stories: '9:16', reels: '9:16',\n  paisagem: '16:9', horizontal: '16:9', banner: '16:9', widescreen: '16:9',\n  original: '', manter: '', mesmo: '',\n};\nconst PROPORCOES = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];\n\nconst entrada = $input.first().json;\nconst descricao = String(entrada.descricao ?? '').trim();\nif (!descricao) throw new Error('Faltou a descrição da imagem.');\n\nconst imagemBase = Math.max(0, Math.floor(Number(entrada.imagem_base) || 0));\nconst pedido = String(entrada.formato ?? '').trim().toLowerCase();\n// Na edição sem formato pedido, a imagem nova mantém o formato da imagem base.\nconst formato = PROPORCOES.includes(pedido) ? pedido : FORMATOS[pedido] ?? (imagemBase && !pedido ? '' : '1:1');\nconst modelo = String(entrada.modelo ?? '').trim().replace(/^models\\//, '') || MODELO_PRINCIPAL;\nconst corpo = {\n  contents: [{ role: 'user', parts: [{ text: descricao }] }],\n  generationConfig: { responseModalities: ['TEXT', 'IMAGE'], ...(formato ? { imageConfig: { aspectRatio: formato } } : {}) },\n};\n\nreturn [\n  {\n    json: {\n      descricao,\n      legenda: String(entrada.legenda ?? '').trim().slice(0, 900),\n      formato,\n      chat_id: String(entrada.chat_id ?? '').trim(),\n      user_id: String(entrada.user_id ?? '').trim(),\n      modelo,\n      modelo_reserva: modelo === MODELO_RESERVA ? MODELO_PRINCIPAL : MODELO_RESERVA,\n      imagem_base: imagemBase,\n      corpo: JSON.stringify(corpo),\n    },\n  },\n];\n" },
    position: [220, 300],
  },
  output: [{ descricao: 'Ilustração minimalista de um farol ao pôr do sol', legenda: 'Farol', formato: '1:1', chat_id: '111111111', user_id: '111111111', modelo: 'gemini-3.1-flash-image', modelo_reserva: 'gemini-2.5-flash-image', imagem_base: 0, corpo: '{}' }],
});

// Edição: com imagem_base, busca a imagem (só as do próprio dono), baixa do Telegram e manda junto ao Gemini.
const editarUmaImagem = ifElse({
  version: 2.3,
  config: {
    name: 'Editar uma imagem?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          { id: 'cond-editar', leftValue: expr('{{ Number($json.imagem_base) || 0 }}'), rightValue: 0, operator: { type: 'number', operation: 'gt' } },
        ],
        combinator: 'and',
      },
      options: {},
    },
    position: [440, 300],
  },
});

const buscarImagemBase = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Buscar imagem base',
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'name', value: 'kira_imagens' },
      matchType: 'allConditions',
      filters: {
        conditions: [
          { keyName: 'id', condition: 'eq', keyValue: expr('{{ $json.imagem_base }}') },
          { keyName: 'user_id', condition: 'eq', keyValue: expr('{{ $json.user_id }}') },
        ],
      },
      limit: 1,
    },
    alwaysOutputData: true,
    executeOnce: true,
    position: [660, 100],
  },
  output: [{ id: 2, user_id: '111111111', chat_id: '111111111', file_id: 'AgACAgEAAxkDAAIBfoto', modelo: 'foto do Telegram' }],
});

const imagemBaseEncontrada = ifElse({
  version: 2.3,
  config: {
    name: 'Imagem base encontrada?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          { id: 'cond-base', leftValue: expr("{{ $json.file_id ?? '' }}"), rightValue: '', operator: { type: 'string', operation: 'notEmpty', singleValue: true } },
        ],
        combinator: 'and',
      },
      options: {},
    },
    position: [880, 100],
  },
});

const baixarImagemBase = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Baixar imagem base',
    parameters: { resource: 'file', operation: 'get', fileId: expr('{{ $json.file_id }}'), download: true, additionalFields: {} },
    credentials: { telegramApi: credTelegram },
    onError: 'continueErrorOutput',
    position: [1100, 0],
  },
  output: [{ ok: true, result: { file_id: 'AgACAgEAAxkDAAIBfoto', file_path: 'photos/file_2.jpg', file_size: 150000 } }],
});

const imagemBaseEmBase64 = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: {
    name: 'Imagem base em base64',
    parameters: { operation: 'binaryToPropery', destinationKey: 'imagem_base64' },
    position: [1320, 0],
  },
  output: [{ imagem_base64: '/9j/4AAQSkZJRg==' }],
});

const pedidoComImagemBase = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Pedido com a imagem base',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Edição: manda a imagem base junto com o pedido, para o Gemini mudar só o que foi pedido.\nconst pedido = $('Preparar pedido').first().json;\nconst baixada = $('Baixar imagem base').first();\nconst imagem = String($input.first().json.imagem_base64 ?? '');\nif (!imagem) throw new Error(`Não consegui ler a imagem #${pedido.imagem_base}.`);\n\n// Tipo da imagem: o que o Telegram informou ou a extensão do arquivo (fotos do Telegram são JPEG).\nconst TIPOS = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' };\nconst informado = String(baixada.binary?.data?.mimeType ?? '');\nconst extensao = String(baixada.json?.result?.file_path ?? '').split('.').pop().toLowerCase();\nconst mime = Object.values(TIPOS).includes(informado) ? informado : TIPOS[extensao] ?? 'image/jpeg';\n\nconst instrucao = [\n  `Edite a imagem enviada. Pedido: ${pedido.descricao}`,\n  'Mude só o que o pedido pede. A peça ou o produto da imagem deve continuar idêntico (formato, cores, materiais, pedras e detalhes), a menos que o pedido mande mudar.',\n  'O resultado deve parecer uma foto real e bem acabada.',\n].join('\\n');\nconst corpo = JSON.parse(pedido.corpo);\ncorpo.contents = [{ role: 'user', parts: [{ inlineData: { mimeType: mime, data: imagem } }, { text: instrucao }] }];\n\nreturn [\n  {\n    json: {\n      ...pedido,\n      descricao: `Edição da imagem #${pedido.imagem_base}: ${pedido.descricao}`,\n      corpo: JSON.stringify(corpo),\n    },\n  },\n];\n" },
    onError: 'continueErrorOutput',
    position: [1540, 0],
  },
  output: [{ descricao: 'Edição da imagem #2: fundo branco', legenda: 'Farol', formato: '', chat_id: '111111111', user_id: '111111111', modelo: 'gemini-3.1-flash-image', modelo_reserva: 'gemini-2.5-flash-image', imagem_base: 2, corpo: '{}' }],
});

const imagemBaseNaoEncontrada = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Imagem base não encontrada',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'base-ok', name: 'ok', value: false, type: 'boolean' },
          {
            id: 'base-erro',
            name: 'erro',
            value: expr(
              "{{ 'Não encontrei a imagem #' + $('Preparar pedido').first().json.imagem_base + '. Só dá para editar fotos que o dono mandou aqui no Telegram e imagens que você gerou. Peça para ele mandar a foto de novo.' }}",
            ),
            type: 'string',
          },
        ],
      },
      options: {},
    },
    position: [1100, 200],
  },
  output: [{ ok: false, erro: 'Não encontrei a imagem #2.' }],
});

const registrarImagem = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Registrar imagem',
    parameters: {
      resource: 'row',
      operation: 'insert',
      dataTableId: { __rl: true, mode: 'name', value: 'kira_imagens' },
      columns: {
        mappingMode: 'defineBelow',
        value: {
          user_id: expr('{{ $json.user_id }}'),
          chat_id: expr('{{ $json.chat_id }}'),
          descricao: expr('{{ $json.descricao }}'),
          legenda: expr('{{ $json.legenda }}'),
          formato: expr('{{ $json.formato }}'),
          modelo: expr('{{ $json.modelo }}'),
        },
        matchingColumns: [],
        schema: [
          { id: 'user_id', displayName: 'user_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'chat_id', displayName: 'chat_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'file_id', displayName: 'file_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'descricao', displayName: 'descricao', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'legenda', displayName: 'legenda', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'formato', displayName: 'formato', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'modelo', displayName: 'modelo', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
        ],
      },
      options: {},
    },
    position: [1760, 300],
  },
  output: [{ id: 1, user_id: '111111111', chat_id: '111111111', descricao: 'Farol', legenda: 'Farol', formato: '1:1', modelo: 'gemini-3.1-flash-image' }],
});

const gerarImagem = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Gerar imagem (Gemini)',
    parameters: {
      method: 'POST',
      url: expr("{{ 'https://generativelanguage.googleapis.com/v1beta/models/' + $('Preparar pedido').first().json.modelo + ':generateContent' }}"),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googlePalmApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr("{{ $('Pedido com a imagem base').isExecuted ? $('Pedido com a imagem base').first().json.corpo : $('Preparar pedido').first().json.corpo }}"),
      options: { timeout: 120000 },
    },
    credentials: { googlePalmApi: credGemini },
    onError: 'continueErrorOutput',
    position: [1980, 300],
  },
  output: [{ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgo=' } }] }, finishReason: 'STOP' }] }],
});

const gerarImagemReserva = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Gerar imagem (reserva)',
    parameters: {
      method: 'POST',
      url: expr("{{ 'https://generativelanguage.googleapis.com/v1beta/models/' + $('Preparar pedido').first().json.modelo_reserva + ':generateContent' }}"),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googlePalmApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr("{{ $('Pedido com a imagem base').isExecuted ? $('Pedido com a imagem base').first().json.corpo : $('Preparar pedido').first().json.corpo }}"),
      options: { timeout: 120000 },
    },
    credentials: { googlePalmApi: credGemini },
    onError: 'continueErrorOutput',
    position: [2200, 500],
  },
  output: [{ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgo=' } }] }, finishReason: 'STOP' }] }],
});

const extrairImagem = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Extrair imagem',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Pega a imagem que o Gemini devolveu (base64) para virar arquivo.\n// Se veio só texto (por exemplo, um pedido recusado), gera um erro com a explicação do modelo.\nconst resposta = $input.first().json;\nconst candidato = resposta.candidates?.[0] ?? {};\nconst partes = candidato.content?.parts ?? [];\nconst imagem = partes.filter((p) => p.inlineData?.data && !p.thought).pop()?.inlineData;\nif (!imagem) {\n  const texto = partes.filter((p) => p.text && !p.thought).map((p) => p.text).join(' ').trim();\n  const motivo = candidato.finishReason || resposta.promptFeedback?.blockReason || '';\n  throw new Error(`O Gemini não devolveu imagem${motivo ? ` (${motivo})` : ''}${texto ? `: ${texto.slice(0, 300)}` : '.'}`);\n}\n\nconst mime = imagem.mimeType || 'image/png';\nconst extensao = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1] || 'png';\nconst id = $('Registrar imagem').first().json.id;\nreturn [{ json: { imagem_base64: imagem.data, mime, nome_arquivo: `kira-imagem-${id}.${extensao}` } }];\n" },
    onError: 'continueErrorOutput',
    position: [2420, 300],
  },
  output: [{ imagem_base64: 'iVBORw0KGgo=', mime: 'image/png', nome_arquivo: 'kira-imagem-1.png' }],
});

const imagemParaArquivo = node({
  type: 'n8n-nodes-base.convertToFile',
  version: 1.1,
  config: {
    name: 'Imagem para arquivo',
    parameters: {
      operation: 'toBinary',
      sourceProperty: 'imagem_base64',
      options: { fileName: expr('{{ $json.nome_arquivo }}'), mimeType: expr('{{ $json.mime }}') },
    },
    position: [2640, 300],
  },
  output: [{}],
});

const enviarImagem = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Enviar imagem',
    parameters: {
      resource: 'message',
      operation: 'sendPhoto',
      chatId: expr("{{ $('Preparar pedido').first().json.chat_id }}"),
      binaryData: true,
      binaryPropertyName: 'data',
      additionalFields: {
        caption: expr(
          "{{ ('🖼️ Imagem #' + $('Registrar imagem').first().json.id + ($('Preparar pedido').first().json.imagem_base ? ' (a partir da #' + $('Preparar pedido').first().json.imagem_base + ')' : '') + ($('Preparar pedido').first().json.legenda ? ' — ' + $('Preparar pedido').first().json.legenda : '')).slice(0, 1024) }}",
        ),
      },
    },
    credentials: { telegramApi: credTelegram },
    onError: 'continueErrorOutput',
    position: [2860, 300],
  },
  output: [{ ok: true, result: { message_id: 50, photo: [{ file_id: 'AgACAgEAAxkDAAIBpequena', width: 320, height: 320 }, { file_id: 'AgACAgEAAxkDAAIBgrande', width: 1024, height: 1024 }] } }],
});

const guardarArquivo = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Guardar arquivo',
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: { __rl: true, mode: 'name', value: 'kira_imagens' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'id', condition: 'eq', keyValue: expr("{{ $('Registrar imagem').first().json.id }}") }] },
      columns: {
        mappingMode: 'defineBelow',
        value: { file_id: expr('{{ $json.result.photo[$json.result.photo.length - 1].file_id }}') },
        matchingColumns: [],
        schema: [{ id: 'file_id', displayName: 'file_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }],
      },
      options: {},
    },
    position: [3080, 300],
  },
  output: [{ id: 1, file_id: 'AgACAgEAAxkDAAIBgrande' }],
});

const imagemPronta = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Imagem pronta',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'img-ok', name: 'ok', value: true, type: 'boolean' },
          { id: 'img-id', name: 'imagem_id', value: expr("{{ $('Registrar imagem').first().json.id }}"), type: 'number' },
          {
            id: 'img-msg',
            name: 'mensagem',
            value: expr(
              "{{ 'A imagem #' + $('Registrar imagem').first().json.id + ($('Preparar pedido').first().json.imagem_base ? ' (edição da imagem #' + $('Preparar pedido').first().json.imagem_base + ')' : '') + ' já está no Telegram do dono. Diga o número dela na resposta e não repita a descrição inteira. Para ajustar esta imagem, use gerar_imagem com imagem_base igual a este número. Para um post do LinkedIn com esta imagem, passe imagem_id em rascunho_linkedin; para anexar a um rascunho de e-mail, use anexar_imagem_email.' }}",
            ),
            type: 'string',
          },
        ],
      },
      options: {},
    },
    position: [3300, 300],
  },
  output: [{ ok: true, imagem_id: 1, mensagem: 'A imagem #1 já está no Telegram do dono.' }],
});

const explicarFalha = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Explicar falha',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Resume o erro para a Kira explicar ao dono (sem travar a conversa).\nconst item = $input.first().json;\nconst bruto = item.error ?? item;\nconst textos = [];\nconst coletar = (valor, profundidade = 0) => {\n  if (!valor || profundidade > 4) return;\n  if (typeof valor === 'string') {\n    textos.push(valor);\n    return;\n  }\n  if (typeof valor === 'object') {\n    for (const chave of ['message', 'description']) {\n      if (typeof valor[chave] === 'string') textos.push(valor[chave]);\n    }\n    coletar(valor.error, profundidade + 1);\n  }\n};\ncoletar(bruto);\n\nlet completo = '';\ntry {\n  completo = JSON.stringify(bruto);\n} catch (e) {\n  completo = textos.join(' ');\n}\nconst erro = [...new Set(textos.map((t) => t.trim()).filter(Boolean))].join(' — ').slice(0, 600) || 'erro desconhecido';\nconst semCota = /quota|RESOURCE_EXHAUSTED|limit: 0|billing|429/i.test(completo + erro);\n\nreturn [\n  {\n    json: {\n      ok: false,\n      imagem_id: 0,\n      erro,\n      sem_cota: semCota,\n      orientacao: semCota\n        ? 'A cota gratuita da API do Google para gerar imagens acabou ou não está disponível agora. Explique isso ao dono em poucas palavras.'\n        : 'Explique o erro ao dono em poucas palavras e sugira tentar de novo com outra descrição.',\n    },\n  },\n];\n" },
    position: [2860, 600],
  },
  output: [{ ok: false, imagem_id: 0, erro: 'erro', sem_cota: false, orientacao: 'Explique o erro ao dono.' }],
});

export default workflow('kira-gerar-imagem', 'Kira — gerar imagem (ferramenta)', { executionOrder: 'v1', timezone: 'America/Sao_Paulo' })
  .add(quandoPedir)
  .to(prepararPedido)
  .to(
    editarUmaImagem
      .onTrue(
        buscarImagemBase.to(
          imagemBaseEncontrada
            .onTrue(baixarImagemBase.to(imagemBaseEmBase64.to(pedidoComImagemBase.to(registrarImagem))))
            .onFalse(imagemBaseNaoEncontrada),
        ),
      )
      .onFalse(registrarImagem),
  )
  .add(registrarImagem)
  .to(gerarImagem)
  .to(extrairImagem)
  .to(imagemParaArquivo)
  .to(enviarImagem)
  .to(guardarArquivo)
  .to(imagemPronta)
  .add(gerarImagem.onError(gerarImagemReserva))
  .add(gerarImagemReserva)
  .to(extrairImagem)
  .add(gerarImagemReserva.onError(explicarFalha))
  .add(extrairImagem.onError(explicarFalha))
  .add(enviarImagem.onError(explicarFalha))
  .add(baixarImagemBase.onError(explicarFalha))
  .add(pedidoComImagemBase.onError(explicarFalha));
