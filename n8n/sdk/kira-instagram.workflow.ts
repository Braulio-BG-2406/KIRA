// Kira — Instagram: sub-workflow da ferramenta instagram da Kira e do comando /instagram <número>.
// A Kira guarda rascunhos de post (imagem ou vídeo + legenda; faixa no vídeo só se o dono pedir) e manda a prévia
// no Telegram; só o dono publica,
// mandando /instagram <número>. Também mostra os últimos posts com curtidas e comentários.
// Tudo isso só no modo Negócios (o ambiente vem do workflow da Kira, nunca da IA).
// Publicação pela API do Instagram com login do Facebook (graph.facebook.com): a credencial Query Auth
// (name access_token) guarda o token da Página do Facebook ligada ao Instagram da loja.
// O Instagram só aceita mídia por um link público: o webhook "Imagem pública" entrega a imagem guardada no
// Telegram (já em JPEG e no formato aceito) ou o vídeo (Reels, até 20 MB), só enquanto o post está sendo
// publicado (chave aleatória). O Reels não usa o link: o vídeo vai direto para o Instagram (envio "resumable").
// As leituras do Facebook trazem links com a chave de acesso: execuções que deram certo não ficam guardadas.
import { workflow, node, trigger, ifElse, switchCase, expr, newCredential } from '@n8n/workflow-sdk';

const credInstagram = newCredential("Instagram da loja");
const credTelegram = newCredential('Telegram account');
const pedidoDaKira = trigger({
  type: "n8n-nodes-base.executeWorkflowTrigger",
  version: 1.1,
  config: {
    name: "Pedido da Kira",
    parameters: {
      inputSource: "workflowInputs",
      workflowInputs: {
        values: [
          { name: "acao", type: "string" },
          { name: "ambiente", type: "string" },
          { name: "origem", type: "string" },
          { name: "user_id", type: "string" },
          { name: "chat_id", type: "string" },
          { name: "imagem_id", type: "number" },
          { name: "video_id", type: "number" },
          { name: "legenda", type: "string" },
          { name: "faixa", type: "string" },
          { name: "rascunho_id", type: "number" },
          { name: "quantidade", type: "number" },
        ],
      },
    },
    position: [0, 600],
  },
  output: [
    { acao: "rascunho", ambiente: "NEGOCIOS", origem: "kira", user_id: "111", chat_id: "111", imagem_id: 3, video_id: 0, legenda: "Legenda do post", faixa: "", rascunho_id: 0, quantidade: 5 },
  ],
});
const validarPedido = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Validar pedido",
    parameters: {
      mode: "runOnceForAllItems",
      language: "javaScript",
      jsCode: "// Confere o pedido e escolhe o caminho. O ambiente vem do workflow da Kira (nó \"Ambiente atual\"), nunca da IA.\n// A IA só guarda rascunhos e consulta; publicar só vem do comando /instagram <número>, mandado pelo dono.\nconst AMBIENTE = 'NEGOCIOS';\nconst ACOES_DA_KIRA = ['rascunho', 'rascunhos', 'posts'];\nconst LIMITE_LEGENDA = 2200;\nconst LIMITE_HASHTAGS = 30;\n// A faixa no vídeo (só quando o dono pede): até 2 linhas de 40 caracteres, como no serviço de vídeo da VPS.\nconst LIMITE_LINHAS_FAIXA = 2;\nconst LIMITE_CARACTERES_FAIXA = 40;\n\nconst e = $input.first().json;\nconst texto = (v) => String(v ?? '').trim();\nconst inteiro = (v) => Math.max(0, Math.floor(Number(v) || 0));\nconst pedido = {\n  acao: texto(e.acao).toLowerCase(),\n  origem: texto(e.origem).toLowerCase(),\n  ambiente: texto(e.ambiente).toUpperCase(),\n  user_id: texto(e.user_id),\n  chat_id: texto(e.chat_id),\n  legenda: texto(e.legenda),\n  faixa: texto(e.faixa)\n    .split(/\\s*[|\\n]\\s*/)\n    .filter(Boolean)\n    .join(' | '),\n  imagem_id: inteiro(e.imagem_id),\n  video_id: inteiro(e.video_id),\n  rascunho_id: inteiro(e.rascunho_id),\n  quantidade: Math.min(10, Math.max(1, inteiro(e.quantidade) || 5)),\n};\nconst recusar = (mensagem) => [{ json: { ...pedido, rota: 'recusar', ok: false, mensagem } }];\n\nif (pedido.acao === 'publicar') {\n  // O rascunho já nasceu no modo Negócios; o comando do dono publica em qualquer ambiente.\n  if (pedido.origem !== 'comando') {\n    return recusar('A publicação no Instagram só acontece quando o dono manda /instagram <número>. Mostre o rascunho e peça para ele mandar o comando.');\n  }\n  if (!pedido.rascunho_id) return recusar('Me diga qual rascunho publicar, por exemplo: /instagram 3');\n  if (!pedido.user_id) return recusar('Não consegui identificar quem pediu a publicação.');\n  return [{ json: { ...pedido, rota: 'publicar' } }];\n}\nif (pedido.ambiente !== AMBIENTE) {\n  return recusar('O Instagram da loja é do ambiente Negócios. Diga ao dono, em uma frase, que ele pode trocar dizendo \"modo negócios\". Não use nem invente dados do Instagram aqui.');\n}\nif (!ACOES_DA_KIRA.includes(pedido.acao)) return recusar('Ação inválida. Use rascunho, rascunhos ou posts.');\nif (!pedido.user_id) return recusar('Não consegui identificar o dono.');\nif (pedido.acao === 'rascunho') {\n  if (!pedido.imagem_id && !pedido.video_id) {\n    return recusar('Todo post do Instagram precisa de uma imagem ou de um vídeo. Para foto, gere ou edite uma com gerar_imagem (ou use o número de uma foto do dono) e passe imagem_id; para Reels, passe video_id (o Vídeo #N que ele mandou).');\n  }\n  if (pedido.imagem_id && pedido.video_id) return recusar('Escolha só um: imagem_id (post de foto) ou video_id (Reels).');\n  if (pedido.faixa) {\n    if (!pedido.video_id) return recusar('A faixa no vídeo só vale para Reels (video_id). Em post de foto, deixe faixa vazia.');\n    const linhas = pedido.faixa.split(' | ');\n    if (linhas.length > LIMITE_LINHAS_FAIXA) return recusar(`A faixa aceita até ${LIMITE_LINHAS_FAIXA} linhas (separe com |).`);\n    if (linhas.some((l) => l.length > LIMITE_CARACTERES_FAIXA)) {\n      return recusar(`Cada linha da faixa aceita até ${LIMITE_CARACTERES_FAIXA} caracteres. Encurte e tente de novo.`);\n    }\n  }\n  if (!pedido.legenda) return recusar('Faltou a legenda do post.');\n  if (pedido.legenda.length > LIMITE_LEGENDA) {\n    return recusar(`A legenda tem ${pedido.legenda.length} caracteres e o Instagram aceita até ${LIMITE_LEGENDA}. Encurte e tente de novo.`);\n  }\n  const hashtags = (pedido.legenda.match(/#[\\p{L}\\p{N}_]+/gu) || []).length;\n  if (hashtags > LIMITE_HASHTAGS) return recusar(`A legenda tem ${hashtags} hashtags e o Instagram aceita até ${LIMITE_HASHTAGS}.`);\n}\nreturn [{ json: { ...pedido, rota: pedido.acao } }];\n",
    },
    position: [220, 600],
  },
  output: [{ ok: true }],
});
const qualCaminho = switchCase({
  version: 3.4,
  config: {
    name: "Qual caminho?",
    parameters: {
      mode: "rules",
      rules: {
        values: [
          {
            renameOutput: true,
            outputKey: "Rascunho",
            conditions: {
              options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
              conditions: [{ id: "rota-rascunho", leftValue: expr("{{ $json.rota }}"), rightValue: "rascunho", operator: { type: "string", operation: "equals" } }],
              combinator: "and",
            },
          },
          {
            renameOutput: true,
            outputKey: "Publicar",
            conditions: {
              options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
              conditions: [{ id: "rota-publicar", leftValue: expr("{{ $json.rota }}"), rightValue: "publicar", operator: { type: "string", operation: "equals" } }],
              combinator: "and",
            },
          },
          {
            renameOutput: true,
            outputKey: "Posts",
            conditions: {
              options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
              conditions: [{ id: "rota-posts", leftValue: expr("{{ $json.rota }}"), rightValue: "posts", operator: { type: "string", operation: "equals" } }],
              combinator: "and",
            },
          },
          {
            renameOutput: true,
            outputKey: "Rascunhos",
            conditions: {
              options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
              conditions: [{ id: "rota-rascunhos", leftValue: expr("{{ $json.rota }}"), rightValue: "rascunhos", operator: { type: "string", operation: "equals" } }],
              combinator: "and",
            },
          },
        ],
      },
      options: { fallbackOutput: "extra", renameFallbackOutput: "Recusar" },
    },
    position: [440, 600],
  },
});
const fotoOuVideo = ifElse({
  version: 2.3,
  config: {
    name: "Foto ou vídeo?",
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
        conditions: [{ id: "fotoOuVideo-cond", leftValue: expr("{{ Number($json.video_id) > 0 }}"), rightValue: "", operator: { type: "boolean", operation: "true", singleValue: true } }],
        combinator: "and",
      },
      options: {},
    },
    position: [560, 160],
  },
});
const buscarVideoDoPost = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Buscar vídeo do post",
    parameters: {
      resource: "row",
      operation: "get",
      dataTableId: { __rl: true, mode: "name", value: "kira_videos" },
      matchType: "allConditions",
      filters: { conditions: [{ keyName: "id", condition: "eq", keyValue: expr("{{ $json.video_id }}") }, { keyName: "user_id", condition: "eq", keyValue: expr("{{ $json.user_id }}") }] },
      limit: 1,
    },
    alwaysOutputData: true,
    executeOnce: true,
    position: [700, -120],
  },
  output: [{ id: 1 }],
});
const videoDoPostServe = ifElse({
  version: 2.3,
  config: {
    name: "Vídeo do post serve?",
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
        conditions: [
          {
            id: "videoDoPostServe-cond",
            leftValue: expr("{{ String($json.file_id ?? '').trim() !== '' && Number($json.tamanho || 0) <= 20 * 1024 * 1024 }}"),
            rightValue: "",
            operator: { type: "boolean", operation: "true", singleValue: true },
          },
        ],
        combinator: "and",
      },
      options: {},
    },
    position: [920, -120],
  },
});
const videoDoPostNaoServe = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {
    name: "Vídeo do post não serve",
    parameters: {
      mode: "manual",
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: "videoDoPostNaoServe-0", name: "ok", value: false, type: "boolean" },
          {
            id: "videoDoPostNaoServe-1",
            name: "mensagem",
            value: expr("{{ !String($json.file_id ?? '').trim() ? 'Não encontrei o vídeo #' + $('Validar pedido').first().json.video_id + '. Confira o número.' : 'O vídeo #' + $('Validar pedido').first().json.video_id + ' tem ' + Math.round(Number($json.tamanho) / 1048576) + ' MB e o robô do Telegram só consegue baixar até 20 MB. Peça para ele mandar o vídeo de novo sem a opção arquivo (o Telegram comprime) ou mais curto.' }}"),
            type: "string",
          },
        ],
      },
      options: {},
    },
    position: [1140, -40],
  },
  output: [{ ok: true, mensagem: "" }],
});
const temFaixa = ifElse({
  version: 2.3,
  config: {
    name: "Tem faixa?",
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
        conditions: [
          {
            id: "temFaixa-cond",
            leftValue: expr("{{ String($('Validar pedido').first().json.faixa ?? '').trim() !== '' }}"),
            rightValue: "",
            operator: { type: "boolean", operation: "true", singleValue: true },
          },
        ],
        combinator: "and",
      },
      options: {},
    },
    position: [1140, -260],
  },
});
const avisarFaixa = node({
  type: "n8n-nodes-base.telegram",
  version: 1.2,
  config: {
    name: "Avisar faixa",
    parameters: {
      resource: "message",
      operation: "sendMessage",
      chatId: expr("{{ $('Validar pedido').first().json.chat_id }}"),
      text: expr("{{ '⏳ Estou colocando a faixa no vídeo #' + $('Validar pedido').first().json.video_id + '. Leva uns 3 minutos; a prévia chega aqui. Não precisa pedir de novo.' }}"),
      additionalFields: { appendAttribution: false },
    },
    credentials: { telegramApi: credTelegram },
    onError: "continueRegularOutput",
    position: [1250, -460],
  },
  output: [{ ok: true }],
});
const baixarVideoFaixa = node({
  type: "n8n-nodes-base.telegram",
  version: 1.2,
  config: {
    name: "Baixar vídeo (faixa)",
    parameters: { resource: "file", operation: "get", fileId: expr("{{ $('Buscar vídeo do post').first().json.file_id }}"), download: true, additionalFields: {} },
    credentials: { telegramApi: credTelegram },
    onError: "continueErrorOutput",
    position: [1360, -360],
  },
  output: [{ ok: true, result: { file_size: 6060695, file_path: "videos/file_2.mp4" } }],
});
const aplicarFaixa = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.2,
  config: {
    name: "Aplicar faixa",
    parameters: {
      method: "POST",
      url: "http://kira-video:8080/faixa",
      sendQuery: true,
      queryParameters: {
        parameters: [
          { name: "texto", value: expr("{{ $('Validar pedido').first().json.faixa }}") },
          { name: "cor", value: "amarelo" },
          { name: "altura", value: "92" },
          { name: "letra", value: "3.2" },
        ],
      },
      sendBody: true,
      contentType: "binaryData",
      inputDataFieldName: "data",
      options: { timeout: 300000, response: { response: { responseFormat: "file", outputPropertyName: "data" } } },
    },
    onError: "continueErrorOutput",
    position: [1580, -360],
  },
  output: [{}],
});
const mostrarPreviaFaixa = node({
  type: "n8n-nodes-base.telegram",
  version: 1.2,
  config: {
    name: "Mostrar prévia (faixa)",
    parameters: {
      resource: "message",
      operation: "sendVideo",
      chatId: expr("{{ $('Validar pedido').first().json.chat_id }}"),
      binaryData: true,
      binaryPropertyName: "data",
      additionalFields: {
        caption: expr("{{ ('🎬 Prévia do Reels com a faixa\\n\\n' + $('Validar pedido').first().json.legenda).slice(0, 960) + '\\n\\nO número do rascunho para publicar vem na resposta da Kira.' }}"),
      },
    },
    credentials: { telegramApi: credTelegram },
    onError: "continueErrorOutput",
    position: [1800, -360],
  },
  output: [{ ok: true, result: { video: { file_id: "BAACAgEAAxkBAAID", duration: 14, width: 720, height: 1280, file_size: 5569222 } } }],
});
const guardarVideoFaixa = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Guardar vídeo com faixa",
    parameters: {
      resource: "row",
      operation: "insert",
      dataTableId: { __rl: true, mode: "name", value: "kira_videos" },
      columns: {
        mappingMode: "defineBelow",
        value: {
          user_id: expr("{{ $('Validar pedido').first().json.user_id }}"),
          chat_id: expr("{{ $('Validar pedido').first().json.chat_id }}"),
          file_id: expr("{{ $json.result?.video?.file_id ?? $json.result?.document?.file_id ?? $json.result?.animation?.file_id ?? '' }}"),
          duracao: expr("{{ $json.result?.video?.duration ?? $('Buscar vídeo do post').first().json.duracao ?? 0 }}"),
          tamanho: expr("{{ $json.result?.video?.file_size ?? 0 }}"),
          largura: expr("{{ $json.result?.video?.width ?? $('Buscar vídeo do post').first().json.largura ?? 0 }}"),
          altura: expr("{{ $json.result?.video?.height ?? $('Buscar vídeo do post').first().json.altura ?? 0 }}"),
          mime: "video/mp4",
          legenda: expr("{{ 'faixa: ' + $('Validar pedido').first().json.faixa }}"),
        },
        matchingColumns: [],
        schema: [
          { id: "user_id", displayName: "user_id", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
          { id: "chat_id", displayName: "chat_id", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
          { id: "file_id", displayName: "file_id", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
          { id: "duracao", displayName: "duracao", required: false, defaultMatch: false, display: true, type: "number", canBeUsedToMatch: true },
          { id: "tamanho", displayName: "tamanho", required: false, defaultMatch: false, display: true, type: "number", canBeUsedToMatch: true },
          { id: "largura", displayName: "largura", required: false, defaultMatch: false, display: true, type: "number", canBeUsedToMatch: true },
          { id: "altura", displayName: "altura", required: false, defaultMatch: false, display: true, type: "number", canBeUsedToMatch: true },
          { id: "mime", displayName: "mime", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
          { id: "legenda", displayName: "legenda", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
        ],
      },
      options: {},
    },
    executeOnce: true,
    position: [2020, -360],
  },
  output: [{ id: 3, file_id: "BAACAgEAAxkBAAID" }],
});
const guardarRascunhoFaixa = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Guardar rascunho (faixa)",
    parameters: {
      resource: "row",
      operation: "insert",
      dataTableId: { __rl: true, mode: "name", value: "kira_instagram" },
      columns: {
        mappingMode: "defineBelow",
        value: {
          user_id: expr("{{ $('Validar pedido').first().json.user_id }}"),
          chat_id: expr("{{ $('Validar pedido').first().json.chat_id }}"),
          imagem_id: 0,
          video_id: expr("{{ $json.id }}"),
          legenda: expr("{{ $('Validar pedido').first().json.legenda }}"),
          status: "pendente",
        },
        matchingColumns: [],
        schema: [
          { id: "user_id", displayName: "user_id", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
          { id: "chat_id", displayName: "chat_id", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
          { id: "imagem_id", displayName: "imagem_id", required: false, defaultMatch: false, display: true, type: "number", canBeUsedToMatch: true },
          { id: "video_id", displayName: "video_id", required: false, defaultMatch: false, display: true, type: "number", canBeUsedToMatch: true },
          { id: "legenda", displayName: "legenda", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
          { id: "status", displayName: "status", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
        ],
      },
      options: {},
    },
    executeOnce: true,
    position: [2240, -360],
  },
  output: [{ id: 8, status: "pendente" }],
});
const rascunhoFaixaPronto = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {
    name: "Rascunho com faixa pronto",
    parameters: {
      mode: "manual",
      includeOtherFields: false,
      options: {},
      assignments: {
        assignments: [
          { id: "rcf-0", name: "ok", value: true, type: "boolean" },
          { id: "rcf-1", name: "rascunho_id", value: expr("{{ $json.id }}"), type: "number" },
          { id: "rcf-2", name: "video_id", value: expr("{{ $('Guardar vídeo com faixa').first().json.id }}"), type: "number" },
          {
            id: "rcf-3",
            name: "mensagem",
            type: "string",
            value: expr("{{ 'Rascunho ' + $json.id + ' do Instagram guardado com o vídeo #' + $('Guardar vídeo com faixa').first().json.id + ' (cópia do vídeo #' + $('Validar pedido').first().json.video_id + ' com a faixa \"' + $('Validar pedido').first().json.faixa + '\"), e a prévia já foi enviada no Telegram. Mostre a legenda completa e diga que, para publicar, ele manda /instagram ' + $json.id + '. Nada foi publicado.' }}"),
          },
        ],
      },
    },
    position: [2460, -360],
  },
  output: [{ ok: true, mensagem: "" }],
});
const faixaFalhou = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {
    name: "Faixa falhou",
    parameters: {
      mode: "manual",
      includeOtherFields: false,
      options: {},
      assignments: {
        assignments: [
          { id: "ff-0", name: "ok", value: false, type: "boolean" },
          {
            id: "ff-1",
            name: "mensagem",
            type: "string",
            value: expr("{{ 'Não consegui colocar a faixa no vídeo #' + $('Validar pedido').first().json.video_id + ' (' + String($json.error?.description ?? $json.error?.message ?? $json.error ?? 'erro desconhecido').replace(/\\s+/g, ' ').slice(0, 200) + '). Nada foi guardado. Diga isso em uma frase e ofereça fazer o rascunho sem a faixa.' }}"),
          },
        ],
      },
    },
    position: [1800, -180],
  },
  output: [{ ok: false, mensagem: "" }],
});
const buscarImagemDoPost = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Buscar imagem do post",
    parameters: {
      resource: "row",
      operation: "get",
      dataTableId: { __rl: true, mode: "name", value: "kira_imagens" },
      matchType: "allConditions",
      filters: { conditions: [{ keyName: "id", condition: "eq", keyValue: expr("{{ $json.imagem_id }}") }, { keyName: "user_id", condition: "eq", keyValue: expr("{{ $json.user_id }}") }] },
      limit: 1,
    },
    alwaysOutputData: true,
    executeOnce: true,
    position: [700, 160],
  },
  output: [{ id: 1 }],
});
const imagemDoPostExiste = ifElse({
  version: 2.3,
  config: {
    name: "Imagem do post existe?",
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
        conditions: [
          {
            id: "imagemDoPostExiste-cond",
            leftValue: expr("{{ String($json.file_id ?? '').trim() !== '' }}"),
            rightValue: "",
            operator: { type: "boolean", operation: "true", singleValue: true },
          },
        ],
        combinator: "and",
      },
      options: {},
    },
    position: [920, 160],
  },
});
const guardarRascunho = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Guardar rascunho",
    parameters: {
      resource: "row",
      operation: "insert",
      dataTableId: { __rl: true, mode: "name", value: "kira_instagram" },
      columns: {
        mappingMode: "defineBelow",
        value: {
          user_id: expr("{{ $('Validar pedido').first().json.user_id }}"),
          chat_id: expr("{{ $('Validar pedido').first().json.chat_id }}"),
          imagem_id: expr("{{ $('Validar pedido').first().json.imagem_id }}"),
          video_id: expr("{{ $('Validar pedido').first().json.video_id }}"),
          legenda: expr("{{ $('Validar pedido').first().json.legenda }}"),
          status: "pendente",
        },
        matchingColumns: [],
        schema: [
          { id: "user_id", displayName: "user_id", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
          { id: "chat_id", displayName: "chat_id", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
          { id: "imagem_id", displayName: "imagem_id", required: false, defaultMatch: false, display: true, type: "number", canBeUsedToMatch: true },
          { id: "video_id", displayName: "video_id", required: false, defaultMatch: false, display: true, type: "number", canBeUsedToMatch: true },
          { id: "legenda", displayName: "legenda", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
          { id: "status", displayName: "status", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
        ],
      },
      options: {},
    },
    executeOnce: true,
    position: [1140, 80],
  },
  output: [{ id: 7, status: "pendente" }],
});
const previaDeVideo = ifElse({
  version: 2.3,
  config: {
    name: "Prévia de vídeo?",
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
        conditions: [
          {
            id: "previaDeVideo-cond",
            leftValue: expr("{{ Number($('Validar pedido').first().json.video_id) > 0 }}"),
            rightValue: "",
            operator: { type: "boolean", operation: "true", singleValue: true },
          },
        ],
        combinator: "and",
      },
      options: {},
    },
    position: [1360, 80],
  },
});
const mostrarPreviaVideo = node({
  type: "n8n-nodes-base.telegram",
  version: 1.2,
  config: {
    name: "Mostrar prévia (vídeo)",
    parameters: {
      resource: "message",
      operation: "sendVideo",
      chatId: expr("{{ $('Validar pedido').first().json.chat_id }}"),
      binaryData: false,
      file: expr("{{ $('Buscar vídeo do post').first().json.file_id }}"),
      additionalFields: {
        caption: expr("{{ ('📸 Prévia do post ' + $('Guardar rascunho').first().json.id + ' do Instagram' + (Number($('Validar pedido').first().json.video_id) > 0 ? ' (Reels)' : '') + '\\n\\n' + $('Validar pedido').first().json.legenda).slice(0, 960) + '\\n\\nPara publicar: /instagram ' + $('Guardar rascunho').first().json.id }}"),
      },
    },
    credentials: { telegramApi: credTelegram },
    onError: "continueRegularOutput",
    position: [1580, 0],
  },
  output: [{ ok: true }],
});
const mostrarPrevia = node({
  type: "n8n-nodes-base.telegram",
  version: 1.2,
  config: {
    name: "Mostrar prévia",
    parameters: {
      resource: "message",
      operation: "sendPhoto",
      chatId: expr("{{ $('Validar pedido').first().json.chat_id }}"),
      binaryData: false,
      file: expr("{{ $('Buscar imagem do post').first().json.file_id }}"),
      additionalFields: {
        caption: expr("{{ ('📸 Prévia do post ' + $('Guardar rascunho').first().json.id + ' do Instagram' + (Number($('Validar pedido').first().json.video_id) > 0 ? ' (Reels)' : '') + '\\n\\n' + $('Validar pedido').first().json.legenda).slice(0, 960) + '\\n\\nPara publicar: /instagram ' + $('Guardar rascunho').first().json.id }}"),
      },
    },
    credentials: { telegramApi: credTelegram },
    onError: "continueRegularOutput",
    position: [1580, 160],
  },
  output: [{ ok: true }],
});
const rascunhoPronto = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {
    name: "Rascunho pronto",
    parameters: {
      mode: "manual",
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: "rascunhoPronto-0", name: "ok", value: true, type: "boolean" },
          { id: "rascunhoPronto-1", name: "rascunho_id", value: expr("{{ $('Guardar rascunho').first().json.id }}"), type: "number" },
          { id: "rascunhoPronto-2", name: "imagem_id", value: expr("{{ $('Validar pedido').first().json.imagem_id }}"), type: "number" },
          { id: "rascunhoPronto-3", name: "video_id", value: expr("{{ $('Validar pedido').first().json.video_id }}"), type: "number" },
          {
            id: "rascunhoPronto-4",
            name: "mensagem",
            value: expr("{{ 'Rascunho ' + $('Guardar rascunho').first().json.id + ' do Instagram guardado com ' + (Number($('Validar pedido').first().json.video_id) > 0 ? 'o vídeo #' + Number($('Validar pedido').first().json.video_id) + ' (Reels)' : 'a imagem #' + $('Validar pedido').first().json.imagem_id) + ((Number($('Validar pedido').first().json.video_id) > 0 ? ($('Mostrar prévia (vídeo)').isExecuted && $('Mostrar prévia (vídeo)').first().json.ok) : ($('Mostrar prévia').isExecuted && $('Mostrar prévia').first().json.ok)) ? ', e a prévia já foi enviada no Telegram' : ' (a prévia NÃO foi enviada no Telegram: diga isso e lembre o número)') + '. Mostre a legenda completa e diga que, para publicar, ele manda /instagram ' + $('Guardar rascunho').first().json.id + '. Nada foi publicado.' }}"),
            type: "string",
          },
        ],
      },
      options: {},
    },
    position: [1800, 80],
  },
  output: [{ ok: true, mensagem: "" }],
});
const imagemDoPostNaoEncontrada = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {
    name: "Imagem do post não encontrada",
    parameters: {
      mode: "manual",
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: "imagemDoPostNaoEncontrada-0", name: "ok", value: false, type: "boolean" },
          {
            id: "imagemDoPostNaoEncontrada-1",
            name: "mensagem",
            value: expr("{{ 'Não encontrei a imagem #' + $('Validar pedido').first().json.imagem_id + ' (ou ela não chegou a ser enviada no Telegram). Gere a imagem de novo ou confira o número.' }}"),
            type: "string",
          },
        ],
      },
      options: {},
    },
    position: [1140, 260],
  },
  output: [{ ok: true, mensagem: "" }],
});
const buscarRascunho = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Buscar rascunho",
    parameters: {
      resource: "row",
      operation: "get",
      dataTableId: { __rl: true, mode: "name", value: "kira_instagram" },
      matchType: "allConditions",
      filters: {
        conditions: [{ keyName: "id", condition: "eq", keyValue: expr("{{ $json.rascunho_id }}") }, { keyName: "user_id", condition: "eq", keyValue: expr("{{ $json.user_id }}") }],
      },
      limit: 1,
    },
    alwaysOutputData: true,
    executeOnce: true,
    position: [700, 560],
  },
  output: [{ id: 1 }],
});
const conferirRascunho = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Conferir rascunho",
    parameters: {
      mode: "runOnceForAllItems",
      language: "javaScript",
      jsCode: "// Confere se o rascunho pode ser publicado agora. \"publicando\" travado há mais de 10 minutos pode tentar de novo.\nconst pedido = $('Validar pedido').first().json;\nconst r = $input.first().json ?? {};\nconst numero = pedido.rascunho_id;\nconst parado = r.status === 'publicando' && Date.now() - new Date(r.updatedAt).getTime() > 10 * 60 * 1000;\nlet mensagem = '';\nif (!r.id) mensagem = `Não encontrei o rascunho ${numero} do Instagram. Peça para eu preparar o post de novo.`;\nelse if (r.status === 'publicado') mensagem = `O rascunho ${numero} já foi publicado no Instagram${r.permalink ? `: ${r.permalink}` : '.'}`;\nelse if (!['pendente', 'erro', 'publicando'].includes(r.status)) mensagem = `O rascunho ${numero} não pode ser publicado (situação: ${r.status || 'desconhecida'}).`;\nelse if (r.status === 'publicando' && !parado) mensagem = `O rascunho ${numero} está sendo publicado agora. Espere um pouco e veja no Instagram.`;\nelse if (!(Number(r.imagem_id) > 0 || Number(r.video_id) > 0) || !String(r.legenda ?? '').trim()) mensagem = `O rascunho ${numero} está sem imagem, sem vídeo ou sem legenda. Peça para eu preparar o post de novo.`;\nreturn [{ json: { ...r, rascunho_id: numero, reels: Number(r.video_id) > 0, pode: !mensagem, ok: !mensagem, mensagem } }];\n",
    },
    position: [920, 560],
  },
  output: [{ ok: true }],
});
const podePublicar = ifElse({
  version: 2.3,
  config: {
    name: "Pode publicar?",
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
        conditions: [{ id: "podePublicar-cond", leftValue: expr("{{ $json.pode === true }}"), rightValue: "", operator: { type: "boolean", operation: "true", singleValue: true } }],
        combinator: "and",
      },
      options: {},
    },
    position: [1140, 560],
  },
});
const naoPodePublicar = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {
    name: "Não pode publicar",
    parameters: {
      mode: "manual",
      includeOtherFields: false,
      assignments: {
        assignments: [{ id: "naoPodePublicar-0", name: "ok", value: false, type: "boolean" }, { id: "naoPodePublicar-1", name: "mensagem", value: expr("{{ $json.mensagem }}"), type: "string" }],
      },
      options: {},
    },
    position: [1360, 700],
  },
  output: [{ ok: true, mensagem: "" }],
});
const gerarLink = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Gerar link da imagem",
    parameters: {
      mode: "runOnceForAllItems",
      language: "javaScript",
      jsCode: "// Cria uma chave aleatória para o link público da imagem. O Instagram baixa a imagem por esse link durante a\n// publicação; a chave só vale enquanto o rascunho está \"publicando\" e é apagada logo depois.\n// O endereço do n8n sai do próprio n8n (o mesmo dos webhooks), sem ficar escrito aqui.\nconst r = $input.first().json;\nconst CAMINHO = 'kira-instagram-imagem';\nlet chave = '';\ntry {\n  chave = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '');\n} catch (e) {\n  chave = '';\n}\nif (chave.length < 32) {\n  const letras = 'abcdefghijklmnopqrstuvwxyz0123456789';\n  chave = Array.from({ length: 48 }, () => letras[Math.floor(Math.random() * letras.length)]).join('');\n}\nconst base = String($execution.resumeUrl ?? '').replace(/\\/webhook-waiting\\/.*$/, '');\nif (!/^https:\\/\\//.test(base)) throw new Error('Não descobri o endereço público (https) do n8n para o link da imagem.');\nreturn [{ json: { ...r, token_imagem: chave, link_imagem: `${base}/webhook/${CAMINHO}?t=${chave}` } }];\n",
    },
    position: [1360, 480],
  },
  output: [{ ok: true }],
});
const marcarPublicando = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Marcar publicando",
    parameters: {
      resource: "row",
      operation: "update",
      dataTableId: { __rl: true, mode: "name", value: "kira_instagram" },
      matchType: "allConditions",
      filters: { conditions: [{ keyName: "id", condition: "eq", keyValue: expr("{{ $json.id }}") }] },
      columns: {
        mappingMode: "defineBelow",
        value: { status: "publicando", token_imagem: expr("{{ $json.token_imagem }}"), erro: "" },
        matchingColumns: [],
        schema: [
          { id: "status", displayName: "status", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
          { id: "token_imagem", displayName: "token_imagem", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
          { id: "erro", displayName: "erro", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
        ],
      },
      options: {},
    },
    executeOnce: true,
    onError: "continueRegularOutput",
    position: [1580, 480],
  },
  output: [{ id: 1 }],
});
const contaDoInstagram = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.2,
  config: {
    name: "Conta do Instagram",
    parameters: {
      method: "GET",
      url: "https://graph.facebook.com/me",
      authentication: "genericCredentialType",
      genericAuthType: "httpQueryAuth",
      sendQuery: true,
      queryParameters: { parameters: [{ name: "fields", value: "instagram_business_account" }] },
      options: { timeout: 60000 },
    },
    credentials: { httpQueryAuth: credInstagram },
    onError: "continueErrorOutput",
    position: [1800, 480],
  },
  output: [{ id: "1", instagram_business_account: { id: "178" } }],
});
const eReels = ifElse({
  version: 2.3,
  config: {
    name: "É Reels?",
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
        conditions: [
          {
            id: "eReels-cond",
            leftValue: expr("{{ $('Conferir rascunho').first().json.reels === true }}"),
            rightValue: "",
            operator: { type: "boolean", operation: "true", singleValue: true },
          },
        ],
        combinator: "and",
      },
      options: {},
    },
    position: [1960, 480],
  },
});
const criarReels = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.2,
  config: {
    name: "Criar Reels",
    parameters: {
      method: "POST",
      url: expr("{{ 'https://graph.facebook.com/' + $json.instagram_business_account.id + '/media' }}"),
      authentication: "genericCredentialType",
      genericAuthType: "httpQueryAuth",
      sendBody: true,
      contentType: "form-urlencoded",
      bodyParameters: {
        parameters: [
          { name: "media_type", value: "REELS" },
          { name: "upload_type", value: "resumable" },
          { name: "caption", value: expr("{{ $('Gerar link da imagem').first().json.legenda }}") },
          { name: "share_to_feed", value: "true" },
        ],
      },
      options: { timeout: 120000 },
    },
    credentials: { httpQueryAuth: credInstagram },
    onError: "continueErrorOutput",
    position: [2180, 400],
  },
  output: [{ id: "181", uri: "https://rupload.facebook.com/ig-api-upload/v23.0/181" }],
});
const buscarVideoEnvio = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Buscar vídeo (envio)",
    parameters: {
      resource: "row",
      operation: "get",
      dataTableId: { __rl: true, mode: "name", value: "kira_videos" },
      matchType: "allConditions",
      filters: {
        conditions: [
          { keyName: "id", condition: "eq", keyValue: expr("{{ $('Conferir rascunho').first().json.video_id }}") },
          { keyName: "user_id", condition: "eq", keyValue: expr("{{ $('Conferir rascunho').first().json.user_id }}") },
        ],
      },
      limit: 1,
    },
    alwaysOutputData: true,
    executeOnce: true,
    position: [2400, 400],
  },
  output: [{ id: 1 }],
});
const baixarVideoEnvio = node({
  type: "n8n-nodes-base.telegram",
  version: 1.2,
  config: {
    name: "Baixar vídeo (envio)",
    parameters: { resource: "file", operation: "get", fileId: expr("{{ $json.file_id ?? '' }}"), download: true, additionalFields: {} },
    credentials: { telegramApi: credTelegram },
    onError: "continueErrorOutput",
    position: [2620, 400],
  },
  output: [{ ok: true, result: { file_size: 6060695, file_path: "videos/file_2.mp4" } }],
});
const enviarVideo = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.2,
  config: {
    name: "Enviar vídeo",
    parameters: {
      method: "POST",
      url: expr("{{ $('Criar Reels').first().json.uri || ('https://rupload.facebook.com/ig-api-upload/v23.0/' + $('Criar Reels').first().json.id) }}"),
      authentication: "genericCredentialType",
      genericAuthType: "httpQueryAuth",
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: "offset", value: "0" },
          { name: "file_size", value: expr("{{ String($('Baixar vídeo (envio)').first().json.result?.file_size || $('Buscar vídeo (envio)').first().json.tamanho || '') }}") },
        ],
      },
      sendBody: true,
      contentType: "binaryData",
      inputDataFieldName: "data",
      options: { timeout: 180000 },
    },
    credentials: { httpQueryAuth: credInstagram },
    onError: "continueErrorOutput",
    position: [2840, 400],
  },
  output: [{ success: true }],
});
const avisarProcessamento = node({
  type: "n8n-nodes-base.telegram",
  version: 1.2,
  config: {
    name: "Avisar processamento",
    parameters: {
      resource: "message",
      operation: "sendMessage",
      chatId: expr("{{ $('Validar pedido').first().json.chat_id }}"),
      text: expr("{{ '⏳ Mandei o vídeo do rascunho ' + $('Conferir rascunho').first().json.id + ' para o Instagram. Ele leva alguns minutos para processar; aviso aqui quando publicar.' }}"),
      additionalFields: { appendAttribution: false },
    },
    credentials: { telegramApi: credTelegram },
    onError: "continueRegularOutput",
    position: [3060, 400],
  },
  output: [{ ok: true }],
});
const criarPost = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.2,
  config: {
    name: "Criar post",
    parameters: {
      method: "POST",
      url: expr("{{ 'https://graph.facebook.com/' + $json.instagram_business_account.id + '/media' }}"),
      authentication: "genericCredentialType",
      genericAuthType: "httpQueryAuth",
      sendBody: true,
      contentType: "form-urlencoded",
      bodyParameters: {
        parameters: [
          { name: "image_url", value: expr("{{ $('Gerar link da imagem').first().json.link_imagem }}") },
          { name: "caption", value: expr("{{ $('Gerar link da imagem').first().json.legenda }}") },
        ],
      },
      options: { timeout: 60000 },
    },
    credentials: { httpQueryAuth: credInstagram },
    onError: "continueErrorOutput",
    position: [2180, 560],
  },
  output: [{ id: "179" }],
});
const postCriado = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {
    name: "Post criado",
    parameters: {
      mode: "manual",
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: "postCriado-0", name: "creation_id", value: expr("{{ $('Criar Reels').isExecuted ? $('Criar Reels').first().json.id : $('Criar post').first().json.id }}"), type: "string" },
        ],
      },
      options: {},
    },
    position: [3280, 480],
  },
  output: [{ ok: true, mensagem: "" }],
});
const esperarInstagram = node({
  type: "n8n-nodes-base.wait",
  version: 1.1,
  config: {
    name: "Esperar o Instagram",
    parameters: { resume: "timeInterval", amount: expr("{{ $('Conferir rascunho').first().json.reels ? 10 : 3 }}"), unit: "seconds" },
    position: [3500, 480],
  },
  output: [{ id: "179" }],
});
const statusDoPost = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.2,
  config: {
    name: "Status do post",
    parameters: {
      method: "GET",
      url: expr("{{ 'https://graph.facebook.com/' + $('Post criado').first().json.creation_id }}"),
      authentication: "genericCredentialType",
      genericAuthType: "httpQueryAuth",
      sendQuery: true,
      queryParameters: { parameters: [{ name: "fields", value: "status_code,status" }] },
      options: { timeout: 60000 },
    },
    credentials: { httpQueryAuth: credInstagram },
    onError: "continueErrorOutput",
    position: [3720, 480],
  },
  output: [{ id: "179", status_code: "FINISHED" }],
});
const conferirProcessamento = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Conferir processamento",
    parameters: {
      mode: "runOnceForAllItems",
      language: "javaScript",
      jsCode: "// Confere se o Instagram terminou de processar a mídia antes de publicar: até 1 minuto para foto e 6 minutos para\n// vídeo (Reels, conferido a cada 10 segundos).\nlet reels = false;\ntry {\n  reels = $('Conferir rascunho').first().json.reels === true;\n} catch (e) {\n  reels = false;\n}\nconst MAX_TENTATIVAS = reels ? 36 : 20;\nconst r = $input.first().json ?? {};\nconst codigo = String(r.status_code ?? '');\nconst tentativa = $runIndex + 1;\nlet situacao = 'esperar';\nlet motivo = '';\nif (codigo === 'FINISHED') situacao = 'pronto';\nelse if (['ERROR', 'EXPIRED', 'PUBLISHED'].includes(codigo)) {\n  situacao = 'falhou';\n  motivo = `O Instagram não aceitou o post: ${r.status || codigo}`;\n} else if (tentativa >= MAX_TENTATIVAS) {\n  situacao = 'falhou';\n  motivo = `O Instagram demorou demais para processar ${reels ? 'o vídeo' : 'a imagem'}. Tente de novo em alguns minutos.`;\n}\nreturn [{ json: { situacao, status_code: codigo, tentativa, ...(motivo ? { error: { message: motivo } } : {}) } }];\n",
    },
    position: [3940, 480],
  },
  output: [{ ok: true }],
});
const postPronto = switchCase({
  version: 3.4,
  config: {
    name: "Post pronto?",
    parameters: {
      mode: "rules",
      rules: {
        values: [
          {
            renameOutput: true,
            outputKey: "Pronto",
            conditions: {
              options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
              conditions: [{ id: "situacao-pronto", leftValue: expr("{{ $json.situacao }}"), rightValue: "pronto", operator: { type: "string", operation: "equals" } }],
              combinator: "and",
            },
          },
          {
            renameOutput: true,
            outputKey: "Esperar",
            conditions: {
              options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
              conditions: [{ id: "situacao-esperar", leftValue: expr("{{ $json.situacao }}"), rightValue: "esperar", operator: { type: "string", operation: "equals" } }],
              combinator: "and",
            },
          },
        ],
      },
      options: { fallbackOutput: "extra", renameFallbackOutput: "Falhou" },
    },
    position: [4160, 480],
  },
});
const publicarPost = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.2,
  config: {
    name: "Publicar post",
    parameters: {
      method: "POST",
      url: expr("{{ 'https://graph.facebook.com/' + $('Conta do Instagram').first().json.instagram_business_account.id + '/media_publish' }}"),
      authentication: "genericCredentialType",
      genericAuthType: "httpQueryAuth",
      sendBody: true,
      contentType: "form-urlencoded",
      bodyParameters: { parameters: [{ name: "creation_id", value: expr("{{ $('Post criado').first().json.creation_id }}") }] },
      options: { timeout: 60000 },
    },
    credentials: { httpQueryAuth: credInstagram },
    onError: "continueErrorOutput",
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 5000,
    position: [4380, 480],
  },
  output: [{ id: "180" }],
});
const linkDoPost = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.2,
  config: {
    name: "Link do post",
    parameters: {
      method: "GET",
      url: expr("{{ 'https://graph.facebook.com/' + $json.id }}"),
      authentication: "genericCredentialType",
      genericAuthType: "httpQueryAuth",
      sendQuery: true,
      queryParameters: { parameters: [{ name: "fields", value: "permalink" }] },
      options: { timeout: 60000 },
    },
    credentials: { httpQueryAuth: credInstagram },
    onError: "continueRegularOutput",
    position: [4600, 480],
  },
  output: [{ id: "180", permalink: "https://www.instagram.com/p/abc/" }],
});
const marcarPublicado = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Marcar publicado",
    parameters: {
      resource: "row",
      operation: "update",
      dataTableId: { __rl: true, mode: "name", value: "kira_instagram" },
      matchType: "allConditions",
      filters: { conditions: [{ keyName: "id", condition: "eq", keyValue: expr("{{ $('Conferir rascunho').first().json.id }}") }] },
      columns: {
        mappingMode: "defineBelow",
        value: {
          status: "publicado",
          media_id: expr("{{ $('Publicar post').first().json.id }}"),
          permalink: expr("{{ $('Link do post').first().json.permalink ?? '' }}"),
          token_imagem: "",
          erro: "",
        },
        matchingColumns: [],
        schema: [
          { id: "status", displayName: "status", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
          { id: "media_id", displayName: "media_id", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
          { id: "permalink", displayName: "permalink", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
          { id: "token_imagem", displayName: "token_imagem", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
          { id: "erro", displayName: "erro", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
        ],
      },
      options: {},
    },
    executeOnce: true,
    onError: "continueRegularOutput",
    position: [4820, 480],
  },
  output: [{ id: 1 }],
});
const postPublicado = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {
    name: "Post publicado",
    parameters: {
      mode: "manual",
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: "postPublicado-0", name: "ok", value: true, type: "boolean" },
          { id: "postPublicado-1", name: "rascunho_id", value: expr("{{ $('Conferir rascunho').first().json.id }}"), type: "number" },
          { id: "postPublicado-2", name: "link", value: expr("{{ $('Link do post').first().json.permalink ?? '' }}"), type: "string" },
          {
            id: "postPublicado-3",
            name: "mensagem",
            value: expr("{{ '✅ Publiquei no Instagram o post do rascunho ' + $('Conferir rascunho').first().json.id + '.' + ($('Link do post').first().json.permalink ? '\\n' + $('Link do post').first().json.permalink : '') }}"),
            type: "string",
          },
        ],
      },
      options: {},
    },
    position: [5040, 480],
  },
  output: [{ ok: true, mensagem: "" }],
});
const explicarFalha = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Explicar falha",
    parameters: {
      mode: "runOnceForAllItems",
      language: "javaScript",
      jsCode: "// Traduz o erro do Facebook/Instagram em uma frase curta (sem chaves nem links).\nconst pedido = $('Validar pedido').first().json;\nconst item = $input.first().json ?? {};\nfunction motivoDoErro(v) {\n  const e = v?.error ?? v;\n  for (const c of [e?.description, e?.message, typeof e === 'string' ? e : '']) {\n    if (!c) continue;\n    const s = String(c);\n    const ini = s.indexOf('{');\n    const fim = s.lastIndexOf('}');\n    let trecho = ini >= 0 && fim > ini ? s.slice(ini, fim + 1) : '';\n    for (let i = 0; trecho && i < 2; i++) {\n      try {\n        const j = JSON.parse(trecho);\n        const g = j.error ?? j;\n        return String(g.error_user_msg || g.message || s);\n      } catch (x) {\n        trecho = trecho.replace(/\\\\\"/g, '\"').replace(/\\\\\\\\/g, '\\\\');\n      }\n    }\n    return s;\n  }\n  return 'erro desconhecido';\n}\nlet motivo = motivoDoErro(item)\n  .replace(/access_token=[^&\\s\"]+/gi, 'access_token=…')\n  .replace(/EAA[A-Za-z0-9]{20,}/g, '…')\n  .replace(/\\s+/g, ' ')\n  .trim()\n  .slice(0, 300);\nconst DICAS = [\n  [/aspect ratio|proporç/i, 'o formato da imagem não é aceito pelo Instagram'],\n  [/video|vídeo|duration|2207026|2207057/i, 'o Instagram não aceitou o vídeo (formato, duração ou tamanho)'],\n  [/could not be fetched|only photo or video|media type|URI/i, 'o Instagram não conseguiu baixar a imagem pelo link temporário'],\n  [/permission|permiss/i, 'falta permissão no app da Meta'],\n  [/session has expired|expired|invalid oauth|Error validating access token/i, 'a chave do Instagram venceu ou foi desligada; é preciso gerar outra'],\n  [/limit|limite/i, 'o limite de publicações do dia foi atingido'],\n];\nconst dica = DICAS.find(([re]) => re.test(motivo))?.[1];\nreturn [{ json: { ...pedido, ok: false, motivo, dica: dica ?? '' } }];\n",
    },
    position: [4160, 760],
  },
  output: [{ ok: true }],
});
const marcarFalha = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Marcar falha",
    parameters: {
      resource: "row",
      operation: "update",
      dataTableId: { __rl: true, mode: "name", value: "kira_instagram" },
      matchType: "allConditions",
      filters: { conditions: [{ keyName: "id", condition: "eq", keyValue: expr("{{ $('Conferir rascunho').first().json.id }}") }] },
      columns: {
        mappingMode: "defineBelow",
        value: { status: "erro", erro: expr("{{ $json.motivo }}"), token_imagem: "" },
        matchingColumns: [],
        schema: [
          { id: "status", displayName: "status", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
          { id: "erro", displayName: "erro", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
          { id: "token_imagem", displayName: "token_imagem", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
        ],
      },
      options: {},
    },
    executeOnce: true,
    onError: "continueRegularOutput",
    position: [4380, 760],
  },
  output: [{ id: 1 }],
});
const falhaNaPublicacao = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {
    name: "Falha na publicação",
    parameters: {
      mode: "manual",
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: "falhaNaPublicacao-0", name: "ok", value: false, type: "boolean" },
          {
            id: "falhaNaPublicacao-1",
            name: "mensagem",
            value: expr("{{ '😕 Não consegui publicar no Instagram o rascunho ' + $('Explicar falha').first().json.rascunho_id + ($('Explicar falha').first().json.dica ? ': ' + $('Explicar falha').first().json.dica : '') + '.\\nMotivo: ' + $('Explicar falha').first().json.motivo + '\\nO rascunho continua guardado. Quando quiser, tente de novo com /instagram ' + $('Explicar falha').first().json.rascunho_id + '.' }}"),
            type: "string",
          },
        ],
      },
      options: {},
    },
    position: [4600, 760],
  },
  output: [{ ok: true, mensagem: "" }],
});
const buscarPosts = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.2,
  config: {
    name: "Buscar posts",
    parameters: {
      method: "GET",
      url: "https://graph.facebook.com/me",
      authentication: "genericCredentialType",
      genericAuthType: "httpQueryAuth",
      sendQuery: true,
      queryParameters: {
        parameters: [
          {
            name: "fields",
            value: expr("{{ 'instagram_business_account{username,followers_count,media_count,media.limit(' + $json.quantidade + '){id,caption,media_type,media_product_type,timestamp,like_count,comments_count,permalink}' + '}' }}"),
          },
        ],
      },
      options: { timeout: 60000 },
    },
    credentials: { httpQueryAuth: credInstagram },
    onError: "continueErrorOutput",
    position: [700, 960],
  },
  output: [{ instagram_business_account: { username: "loja", followers_count: 10, media_count: 5, media: { data: [] } } }],
});
const separarPosts = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Separar posts",
    parameters: {
      mode: "runOnceForAllItems",
      language: "javaScript",
      jsCode: "// Um item por post, para buscar os números de cada um (o Instagram dá alcance e visualizações post a post).\nconst posts = $input.first().json.instagram_business_account?.media?.data ?? [];\nreturn posts.length ? posts.map((p) => ({ json: { id: String(p.id ?? '') } })) : [{ json: { id: '' } }];\n",
    },
    position: [920, 960],
  },
  output: [{ ok: true }],
});
const buscarAlcance = node({
  type: "n8n-nodes-base.httpRequest",
  version: 4.2,
  config: {
    name: "Buscar alcance",
    parameters: {
      method: "GET",
      url: expr("{{ 'https://graph.facebook.com/' + $json.id + '/insights' }}"),
      authentication: "genericCredentialType",
      genericAuthType: "httpQueryAuth",
      sendQuery: true,
      queryParameters: { parameters: [{ name: "metric", value: "reach,views,saved,shares" }] },
      options: { timeout: 30000 },
    },
    credentials: { httpQueryAuth: credInstagram },
    onError: "continueRegularOutput",
    position: [1140, 960],
  },
  output: [{ data: [{ name: "reach", period: "lifetime", values: [{ value: 120 }] }, { name: "views", period: "lifetime", values: [{ value: 300 }] }] }],
});
const resumirPosts = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Resumir posts",
    parameters: {
      mode: "runOnceForAllItems",
      language: "javaScript",
      jsCode: "// Resume a conta e os últimos posts, com o alcance e as visualizações de cada um. Devolve só números e textos\n// curtos: nunca os links de paginação do Facebook nem o texto bruto dos erros, que podem carregar a chave de acesso.\nconst FUSO = 'America/Sao_Paulo';\nconst TIPOS = { IMAGE: 'foto', CAROUSEL_ALBUM: 'carrossel', VIDEO: 'vídeo' };\nconst conta = $('Buscar posts').first().json.instagram_business_account;\nif (!conta || !conta.username) throw new Error('A Página do Facebook não tem uma conta do Instagram ligada.');\nconst quando = (iso) => {\n  const d = new Date(String(iso ?? '').replace(/([+-]\\d\\d)(\\d\\d)$/, '$1:$2'));\n  return isNaN(d) ? '' : DateTime.fromJSDate(d).setZone(FUSO).toFormat('dd/MM/yyyy HH:mm');\n};\nconst curta = (s, n) => {\n  const t = String(s ?? '').replace(/\\s+/g, ' ').trim();\n  return t.length > n ? t.slice(0, n - 1) + '…' : t;\n};\n// Números de cada post, na mesma ordem dos posts (o nó anterior devolve um item por post, com erro ou não).\nconst numeros = $input.all().map((i) => i.json);\nconst metricas = (r) => {\n  const m = {};\n  for (const x of Array.isArray(r?.data) ? r.data : []) {\n    const v = x?.values?.[0]?.value ?? x?.total_value?.value;\n    if (x?.name && typeof v === 'number') m[x.name] = v;\n  }\n  return m;\n};\nlet falhou = '';\nconst posts = (conta.media?.data ?? []).map((p, i) => {\n  const r = numeros[i] ?? {};\n  if (r.error && !falhou) falhou = /\\(#10\\)|\\(#200\\)|permiss/i.test(JSON.stringify(r.error)) ? 'sem permissão' : 'indisponível';\n  const m = metricas(r);\n  return {\n    posicao: i + 1,\n    data: quando(p.timestamp),\n    tipo: p.media_product_type === 'REELS' ? 'reels' : TIPOS[p.media_type] ?? String(p.media_type ?? '').toLowerCase(),\n    legenda: curta(p.caption, 150),\n    curtidas: p.like_count ?? null,\n    comentarios: p.comments_count ?? null,\n    alcance: m.reach ?? null,\n    visualizacoes: m.views ?? null,\n    salvamentos: m.saved ?? null,\n    compartilhamentos: m.shares ?? null,\n    link: p.permalink ?? '',\n  };\n});\nconst comNumeros = posts.filter((p) => p.alcance !== null || p.visualizacoes !== null).length;\nlet observacao = 'Os números contam até agora; o Instagram atualiza alcance e visualizações com algumas horas de atraso. Alcance = contas diferentes que viram o post; visualizações = vezes que ele foi visto.';\nif (!comNumeros && posts.length) {\n  observacao = falhou === 'sem permissão'\n    ? 'Alcance e visualizações não vieram: o Instagram recusou por falta de permissão (a chave do Instagram no n8n precisa da permissão instagram_manage_insights).'\n    : 'Alcance e visualizações não vieram agora (o Instagram não respondeu esses números). Curtidas e comentários estão certos.';\n} else if (comNumeros < posts.length) {\n  observacao += ' Alguns posts vieram sem esses números (o Instagram não tem números para posts antigos ou de antes da conta virar profissional).';\n}\nreturn [\n  {\n    json: {\n      ok: true,\n      conta: '@' + conta.username,\n      seguidores: conta.followers_count ?? null,\n      total_de_posts: conta.media_count ?? null,\n      posts,\n      observacao,\n    },\n  },\n];\n",
    },
    onError: "continueErrorOutput",
    position: [1360, 960],
  },
  output: [{ ok: true }],
});
const falhaNosPosts = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {
    name: "Falha nos posts",
    parameters: {
      mode: "manual",
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: "falhaNosPosts-0", name: "ok", value: false, type: "boolean" },
          {
            id: "falhaNosPosts-1",
            name: "mensagem",
            value: expr("{{ 'Não consegui ler o Instagram agora. Erro: ' + String($json.error?.message ?? $json.error ?? '').slice(0, 300) }}"),
            type: "string",
          },
        ],
      },
      options: {},
    },
    position: [1140, 1060],
  },
  output: [{ ok: true, mensagem: "" }],
});
const buscarRascunhos = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Buscar rascunhos",
    parameters: {
      resource: "row",
      operation: "get",
      dataTableId: { __rl: true, mode: "name", value: "kira_instagram" },
      matchType: "allConditions",
      filters: { conditions: [{ keyName: "user_id", condition: "eq", keyValue: expr("{{ $json.user_id }}") }] },
      returnAll: true,
    },
    alwaysOutputData: true,
    executeOnce: true,
    position: [700, 1200],
  },
  output: [{ id: 1 }],
});
const listarRascunhos = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Listar rascunhos",
    parameters: {
      mode: "runOnceForAllItems",
      language: "javaScript",
      jsCode: "// Lista os rascunhos do Instagram que ainda não foram publicados (os mais novos primeiro).\nconst PENDENTES = ['pendente', 'erro'];\nconst lista = $input\n  .all()\n  .map((item) => item.json)\n  .filter((r) => r && r.id && PENDENTES.includes(r.status))\n  .sort((a, b) => b.id - a.id)\n  .slice(0, 10);\nreturn [\n  {\n    json: {\n      ok: true,\n      total: lista.length,\n      rascunhos: lista.map((r) => ({\n        rascunho: r.id,\n        imagem: Number(r.imagem_id) || 0,\n        video: Number(r.video_id) || 0,\n        status: r.status === 'erro' ? 'falhou na última tentativa' : 'pendente',\n        legenda: String(r.legenda ?? '').slice(0, 200),\n        ...(r.erro ? { erro: String(r.erro).slice(0, 200) } : {}),\n      })),\n      mensagem: lista.length\n        ? 'Para publicar um rascunho, o dono manda /instagram <número>.'\n        : 'Não há rascunhos do Instagram esperando publicação.',\n    },\n  },\n];\n",
    },
    position: [920, 1200],
  },
  output: [{ ok: true }],
});
const pedidoRecusado = node({
  type: "n8n-nodes-base.set",
  version: 3.4,
  config: {
    name: "Pedido recusado",
    parameters: {
      mode: "manual",
      includeOtherFields: false,
      assignments: {
        assignments: [{ id: "pedidoRecusado-0", name: "ok", value: false, type: "boolean" }, { id: "pedidoRecusado-1", name: "mensagem", value: expr("{{ $json.mensagem }}"), type: "string" }],
      },
      options: {},
    },
    position: [700, 1360],
  },
  output: [{ ok: true, mensagem: "" }],
});
const imagemPublica = trigger({
  type: "n8n-nodes-base.webhook",
  version: 2,
  config: { name: "Imagem pública", parameters: { httpMethod: "GET", path: "kira-instagram-imagem", responseMode: "responseNode", options: {} }, position: [0, 1700] },
  output: [{ query: { t: "chave" }, headers: {}, params: {}, body: {} }],
});
const buscarPostPelaChave = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Buscar post pela chave",
    parameters: {
      resource: "row",
      operation: "get",
      dataTableId: { __rl: true, mode: "name", value: "kira_instagram" },
      matchType: "allConditions",
      filters: {
        conditions: [
          { keyName: "token_imagem", condition: "eq", keyValue: expr("{{ String($json.query?.t ?? '').slice(0, 100) || 'sem-chave' }}") },
          { keyName: "status", condition: "eq", keyValue: "publicando" },
        ],
      },
      limit: 1,
    },
    alwaysOutputData: true,
    executeOnce: true,
    position: [220, 1700],
  },
  output: [{ id: 1 }],
});
const chaveValida = ifElse({
  version: 2.3,
  config: {
    name: "Chave válida?",
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
        conditions: [
          {
            id: "chaveValida-cond",
            leftValue: expr("{{ String($('Imagem pública').first().json.query?.t ?? '').length >= 32 && $json.token_imagem === String($('Imagem pública').first().json.query?.t ?? '') && (Number($json.imagem_id) > 0 || Number($json.video_id) > 0) }}"),
            rightValue: "",
            operator: { type: "boolean", operation: "true", singleValue: true },
          },
        ],
        combinator: "and",
      },
      options: {},
    },
    position: [440, 1700],
  },
});
const videoOuFotoLink = ifElse({
  version: 2.3,
  config: {
    name: "Vídeo ou foto? (link)",
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
        conditions: [{ id: "videoOuFotoLink-cond", leftValue: expr("{{ Number($json.video_id) > 0 }}"), rightValue: "", operator: { type: "boolean", operation: "true", singleValue: true } }],
        combinator: "and",
      },
      options: {},
    },
    position: [600, 1700],
  },
});
const buscarImagemDoLink = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Buscar imagem (link)",
    parameters: {
      resource: "row",
      operation: "get",
      dataTableId: { __rl: true, mode: "name", value: "kira_imagens" },
      matchType: "allConditions",
      filters: { conditions: [{ keyName: "id", condition: "eq", keyValue: expr("{{ $json.imagem_id }}") }, { keyName: "user_id", condition: "eq", keyValue: expr("{{ $json.user_id }}") }] },
      limit: 1,
    },
    alwaysOutputData: true,
    executeOnce: true,
    position: [820, 1620],
  },
  output: [{ id: 1 }],
});
const baixarImagemDoLink = node({
  type: "n8n-nodes-base.telegram",
  version: 1.2,
  config: {
    name: "Baixar imagem (link)",
    parameters: { resource: "file", operation: "get", fileId: expr("{{ $json.file_id ?? '' }}"), download: true, additionalFields: {} },
    credentials: { telegramApi: credTelegram },
    onError: "continueErrorOutput",
    position: [1040, 1620],
  },
  output: [{ ok: true, result: { file_path: "photos/file_1.jpg" } }],
});
const tamanhoDaImagem = node({
  type: "n8n-nodes-base.editImage",
  version: 1.1,
  config: { name: "Tamanho da imagem", parameters: { operation: "information", dataPropertyName: "data" }, onError: "continueErrorOutput", position: [1260, 1620] },
  output: [{ size: { width: 1024, height: 1024 } }],
});
const calcularFormato = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Calcular formato",
    parameters: {
      mode: "runOnceForAllItems",
      language: "javaScript",
      jsCode: "// O Instagram aceita fotos entre 4:5 (em pé) e 1,91:1 (deitada). Se a imagem passar disso, corta um pouco\n// (até 12%) ou, se precisar cortar mais, completa com faixas para não perder a peça.\nconst MIN = 0.8;\nconst MAX = 1.91;\nconst CORTE_MAXIMO = 0.12;\nconst item = $input.first();\nconst largura = Number(item.json.size?.width) || 0;\nconst altura = Number(item.json.size?.height) || 0;\nif (!largura || !altura) throw new Error('Não consegui ler o tamanho da imagem.');\nlet corteLargura = largura;\nlet corteAltura = altura;\nlet faixaLargura = 0;\nlet faixaAltura = 0;\nconst proporcao = largura / altura;\nif (proporcao < MIN) {\n  const ideal = Math.floor(largura / MIN);\n  if (1 - ideal / altura <= CORTE_MAXIMO) corteAltura = ideal;\n  else faixaLargura = Math.ceil((altura * MIN - largura) / 2);\n} else if (proporcao > MAX) {\n  const ideal = Math.floor(altura * MAX);\n  if (1 - ideal / largura <= CORTE_MAXIMO) corteLargura = ideal;\n  else faixaAltura = Math.ceil((largura / MAX - altura) / 2);\n}\n// Faixas escuras para fotos escuras e brancas para fotos claras.\nconst medias = ['Red', 'Green', 'Blue'].map((canal) => {\n  const m = String(item.json['Channel Statistics']?.[canal]?.Mean ?? '').match(/\\(([\\d.]+)\\)/);\n  return m ? Number(m[1]) : 1;\n});\nconst clara = medias.reduce((a, b) => a + b, 0) / medias.length >= 0.5;\nreturn [\n  {\n    json: {\n      largura,\n      altura,\n      corte_largura: corteLargura,\n      corte_altura: corteAltura,\n      corte_x: Math.floor((largura - corteLargura) / 2),\n      corte_y: Math.floor((altura - corteAltura) / 2),\n      faixa_largura: faixaLargura,\n      faixa_altura: faixaAltura,\n      cor_faixa: clara ? '#FFFFFF' : '#000000',\n    },\n    binary: item.binary,\n  },\n];\n",
    },
    onError: "continueErrorOutput",
    position: [1480, 1620],
  },
  output: [{ ok: true }],
});
const ajustarParaInstagram = node({
  type: "n8n-nodes-base.editImage",
  version: 1.1,
  config: {
    name: "Ajustar para o Instagram",
    parameters: {
      operation: "multiStep",
      dataPropertyName: "data",
      operations: {
        operations: [
          {
            operation: "crop",
            width: expr("{{ $json.corte_largura }}"),
            height: expr("{{ $json.corte_altura }}"),
            positionX: expr("{{ $json.corte_x }}"),
            positionY: expr("{{ $json.corte_y }}"),
          },
          { operation: "border", borderWidth: expr("{{ $json.faixa_largura }}"), borderHeight: expr("{{ $json.faixa_altura }}"), borderColor: expr("{{ $json.cor_faixa }}") },
        ],
      },
      options: { format: "jpeg", quality: 92, fileName: "post.jpg" },
    },
    onError: "continueErrorOutput",
    position: [1700, 1620],
  },
  output: [{}],
});
const entregarImagem = node({
  type: "n8n-nodes-base.respondToWebhook",
  version: 1.1,
  config: {
    name: "Entregar imagem",
    parameters: {
      respondWith: "binary",
      responseDataSource: "automatically",
      options: { responseCode: 200, responseHeaders: { entries: [{ name: "Content-Type", value: "image/jpeg" }, { name: "Cache-Control", value: "no-store" }] } },
    },
    position: [1920, 1620],
  },
  output: [{}],
});
const buscarVideoDoLink = node({
  type: "n8n-nodes-base.dataTable",
  version: 1.1,
  config: {
    name: "Buscar vídeo (link)",
    parameters: {
      resource: "row",
      operation: "get",
      dataTableId: { __rl: true, mode: "name", value: "kira_videos" },
      matchType: "allConditions",
      filters: { conditions: [{ keyName: "id", condition: "eq", keyValue: expr("{{ $json.video_id }}") }, { keyName: "user_id", condition: "eq", keyValue: expr("{{ $json.user_id }}") }] },
      limit: 1,
    },
    alwaysOutputData: true,
    executeOnce: true,
    position: [820, 1900],
  },
  output: [{ id: 1 }],
});
const baixarVideoDoLink = node({
  type: "n8n-nodes-base.telegram",
  version: 1.2,
  config: {
    name: "Baixar vídeo (link)",
    parameters: { resource: "file", operation: "get", fileId: expr("{{ $json.file_id ?? '' }}"), download: true, additionalFields: {} },
    credentials: { telegramApi: credTelegram },
    onError: "continueErrorOutput",
    position: [1040, 1900],
  },
  output: [{ ok: true, result: { file_path: "videos/file_2.mp4" } }],
});
const entregarVideo = node({
  type: "n8n-nodes-base.respondToWebhook",
  version: 1.1,
  config: {
    name: "Entregar vídeo",
    parameters: {
      respondWith: "binary",
      responseDataSource: "automatically",
      options: { responseCode: 200, responseHeaders: { entries: [{ name: "Content-Type", value: "video/mp4" }, { name: "Cache-Control", value: "no-store" }] } },
    },
    position: [1260, 1900],
  },
  output: [{}],
});
const imagemNaoEncontrada = node({
  type: "n8n-nodes-base.respondToWebhook",
  version: 1.1,
  config: {
    name: "Imagem não encontrada",
    parameters: { respondWith: "text", responseBody: "Não encontrado.", options: { responseCode: 404, responseHeaders: { entries: [{ name: "Cache-Control", value: "no-store" }] } } },
    position: [1920, 2100],
  },
  output: [{}],
});

export default workflow('kira-instagram', 'Kira — Instagram (ferramenta)', {
  executionOrder: "v1",
  timezone: "America/Sao_Paulo",
  callerPolicy: "workflowsFromSameOwner",
  saveDataSuccessExecution: "none",
  saveDataErrorExecution: "all",
  saveManualExecutions: false,
})
  .add(pedidoDaKira)
  .to(validarPedido)
  .to(
    qualCaminho
      .onCase(0, fotoOuVideo.onTrue(buscarVideoDoPost.to(videoDoPostServe.onTrue(temFaixa.onTrue(avisarFaixa.to(baixarVideoFaixa.to(aplicarFaixa.to(mostrarPreviaFaixa.to(guardarVideoFaixa.to(guardarRascunhoFaixa.to(rascunhoFaixaPronto))))))).onFalse(guardarRascunho)).onFalse(videoDoPostNaoServe))).onFalse(buscarImagemDoPost.to(imagemDoPostExiste.onTrue(guardarRascunho.to(previaDeVideo.onTrue(mostrarPreviaVideo.to(rascunhoPronto)).onFalse(mostrarPrevia.to(rascunhoPronto)))).onFalse(imagemDoPostNaoEncontrada))))
      .onCase(1, buscarRascunho.to(conferirRascunho.to(podePublicar.onTrue(gerarLink.to(marcarPublicando.to(contaDoInstagram.to(eReels.onTrue(criarReels.to(buscarVideoEnvio.to(baixarVideoEnvio.to(enviarVideo.to(avisarProcessamento.to(postCriado)))))).onFalse(criarPost.to(postCriado.to(esperarInstagram.to(statusDoPost.to(conferirProcessamento.to(postPronto.onCase(0, publicarPost.to(linkDoPost.to(marcarPublicado.to(postPublicado)))).onCase(1, esperarInstagram).onCase(2, explicarFalha))))))))))).onFalse(naoPodePublicar))))
      .onCase(2, buscarPosts.to(separarPosts.to(buscarAlcance.to(resumirPosts))))
      .onCase(3, buscarRascunhos.to(listarRascunhos))
      .onCase(4, pedidoRecusado),
  )
  .add(baixarVideoFaixa.onError(faixaFalhou))
  .add(aplicarFaixa.onError(faixaFalhou))
  .add(mostrarPreviaFaixa.onError(faixaFalhou))
  .add(contaDoInstagram.onError(explicarFalha))
  .add(criarReels.onError(explicarFalha))
  .add(baixarVideoEnvio.onError(explicarFalha))
  .add(enviarVideo.onError(explicarFalha))
  .add(criarPost.onError(explicarFalha))
  .add(statusDoPost.onError(explicarFalha))
  .add(publicarPost.onError(explicarFalha.to(marcarFalha.to(falhaNaPublicacao))))
  .add(buscarPosts.onError(falhaNosPosts))
  .add(resumirPosts.onError(falhaNosPosts))
  .add(imagemPublica)
  .to(buscarPostPelaChave)
  .to(chaveValida.onTrue(videoOuFotoLink.onTrue(buscarVideoDoLink.to(baixarVideoDoLink.to(entregarVideo))).onFalse(buscarImagemDoLink.to(baixarImagemDoLink.to(tamanhoDaImagem.to(calcularFormato.to(ajustarParaInstagram.to(entregarImagem))))))).onFalse(imagemNaoEncontrada))
  .add(baixarVideoDoLink.onError(imagemNaoEncontrada))
  .add(baixarImagemDoLink.onError(imagemNaoEncontrada))
  .add(tamanhoDaImagem.onError(imagemNaoEncontrada))
  .add(calcularFormato.onError(imagemNaoEncontrada))
  .add(ajustarParaInstagram.onError(imagemNaoEncontrada));
