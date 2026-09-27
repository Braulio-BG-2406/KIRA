// Kira — anexar imagem ao e-mail: sub-workflow chamado pela ferramenta "anexar_imagem_email" da Kira.
// Pega uma imagem gerada pela Kira (tabela kira_imagens), baixa do Telegram e anexa a um
// RASCUNHO do Outlook. Não envia nada: o dono revisa e envia pelo Outlook.
import { workflow, node, trigger, ifElse, expr, newCredential } from '@n8n/workflow-sdk';

const credTelegram = newCredential('Telegram account');
const credOutlook = newCredential('Microsoft Outlook account');

const quandoPedir = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: {
    name: 'Quando a Kira pedir um anexo',
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'rascunho_id', type: 'string' },
          { name: 'imagem_id', type: 'number' },
          { name: 'user_id', type: 'string' },
        ],
      },
    },
    position: [0, 300],
  },
  output: [{ rascunho_id: 'AAMkAGI2rascunho', imagem_id: 1, user_id: '111111111' }],
});

const buscarImagem = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Buscar imagem',
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'name', value: 'kira_imagens' },
      matchType: 'allConditions',
      filters: {
        conditions: [
          { keyName: 'id', condition: 'eq', keyValue: expr('{{ Number($json.imagem_id) || 0 }}') },
          { keyName: 'user_id', condition: 'eq', keyValue: expr('{{ $json.user_id }}') },
        ],
      },
      limit: 1,
    },
    alwaysOutputData: true,
    executeOnce: true,
    position: [220, 300],
  },
  output: [{ id: 1, user_id: '111111111', chat_id: '111111111', file_id: 'AgACAgEAAxkDAAIBgrande', legenda: 'Farol' }],
});

const imagemEncontrada = ifElse({
  version: 2.3,
  config: {
    name: 'Imagem encontrada?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          { id: 'cond-imagem', leftValue: expr("{{ $json.file_id ?? '' }}"), rightValue: '', operator: { type: 'string', operation: 'notEmpty', singleValue: true } },
        ],
        combinator: 'and',
      },
      options: {},
    },
    position: [440, 300],
  },
});

const baixarImagem = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Baixar imagem',
    parameters: { resource: 'file', operation: 'get', fileId: expr('{{ $json.file_id }}'), download: true, additionalFields: {} },
    credentials: { telegramApi: credTelegram },
    onError: 'continueErrorOutput',
    position: [660, 200],
  },
  output: [{ ok: true, result: { file_id: 'AgACAgEAAxkDAAIBgrande', file_path: 'photos/file_1.jpg', file_size: 180000 } }],
});

const imagemEmBase64 = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: {
    name: 'Imagem em base64',
    parameters: { operation: 'binaryToPropery', destinationKey: 'imagem_base64' },
    position: [880, 200],
  },
  output: [{ imagem_base64: '/9j/4AAQSkZJRg==' }],
});

// Anexo simples do Microsoft Graph (até 3 MB; as fotos do Telegram têm poucas centenas de KB).
const anexarAoRascunho = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Anexar ao rascunho',
    parameters: {
      method: 'POST',
      url: expr("{{ 'https://graph.microsoft.com/v1.0/me/messages/' + encodeURIComponent($('Quando a Kira pedir um anexo').first().json.rascunho_id) + '/attachments' }}"),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'microsoftOutlookOAuth2Api',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        "{{ JSON.stringify({ '@odata.type': '#microsoft.graph.fileAttachment', name: 'kira-imagem-' + $('Buscar imagem').first().json.id + '.jpg', contentType: 'image/jpeg', contentBytes: $json.imagem_base64 }) }}",
      ),
      options: { timeout: 60000 },
    },
    credentials: { microsoftOutlookOAuth2Api: credOutlook },
    onError: 'continueErrorOutput',
    position: [1100, 200],
  },
  output: [{ id: 'AAMkAGI2anexo', name: 'kira-imagem-1.jpg', contentType: 'image/jpeg', size: 180000 }],
});

const anexoPronto = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Anexo pronto',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'anx-ok', name: 'ok', value: true, type: 'boolean' },
          {
            id: 'anx-msg',
            name: 'mensagem',
            value: expr("{{ 'A imagem #' + $('Buscar imagem').first().json.id + ' foi anexada ao rascunho. Nada foi enviado: o dono revisa e envia pelo Outlook.' }}"),
            type: 'string',
          },
        ],
      },
      options: {},
    },
    position: [1320, 200],
  },
  output: [{ ok: true, mensagem: 'A imagem #1 foi anexada ao rascunho.' }],
});

const imagemNaoEncontrada = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Imagem não encontrada',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'nf-ok', name: 'ok', value: false, type: 'boolean' },
          {
            id: 'nf-erro',
            name: 'erro',
            value: expr("{{ 'Não encontrei a imagem #' + $('Quando a Kira pedir um anexo').first().json.imagem_id + '. Gere a imagem de novo com gerar_imagem e use o número novo.' }}"),
            type: 'string',
          },
        ],
      },
      options: {},
    },
    position: [660, 450],
  },
  output: [{ ok: false, erro: 'Não encontrei a imagem #1.' }],
});

const explicarFalha = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Explicar falha',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Resume o erro ao anexar a imagem, para a Kira explicar ao dono.\nconst item = $input.first().json;\nconst bruto = item.error ?? item;\nconst textos = [];\nconst coletar = (valor, profundidade = 0) => {\n  if (!valor || profundidade > 4) return;\n  if (typeof valor === 'string') {\n    textos.push(valor);\n    return;\n  }\n  if (typeof valor === 'object') {\n    for (const chave of ['message', 'description']) {\n      if (typeof valor[chave] === 'string') textos.push(valor[chave]);\n    }\n    coletar(valor.error, profundidade + 1);\n  }\n};\ncoletar(bruto);\nconst erro = [...new Set(textos.map((t) => t.trim()).filter(Boolean))].join(' — ').slice(0, 600) || 'erro desconhecido';\n\nreturn [\n  {\n    json: {\n      ok: false,\n      erro,\n      orientacao: 'Não foi possível anexar a imagem. Explique o erro ao dono em poucas palavras; o rascunho continua na pasta Rascunhos, sem a imagem.',\n    },\n  },\n];\n" },
    position: [1320, 450],
  },
  output: [{ ok: false, erro: 'erro', orientacao: 'Explique o erro ao dono.' }],
});

export default workflow('kira-anexar-imagem', 'Kira — anexar imagem ao e-mail (ferramenta)', { executionOrder: 'v1', timezone: 'America/Sao_Paulo' })
  .add(quandoPedir)
  .to(buscarImagem)
  .to(imagemEncontrada.onTrue(baixarImagem.to(imagemEmBase64.to(anexarAoRascunho.to(anexoPronto)))).onFalse(imagemNaoEncontrada))
  .add(baixarImagem.onError(explicarFalha))
  .add(anexarAoRascunho.onError(explicarFalha));
