// Kira — rascunho de resposta: cria o RASCUNHO de resposta de um e-mail do Outlook com a assinatura
// do dono (a imagem guardada no Google Drive e o e-mail logo abaixo). Usado pela ferramenta
// criar_rascunho_resposta da Kira e pelos rascunhos automáticos. Nunca envia nada.
import { workflow, node, trigger, ifElse, expr, newCredential } from '@n8n/workflow-sdk';

const credOutlook = newCredential('Microsoft Outlook account');
const credDrive = newCredential('Google Drive account');
const GRAPH = 'https://graph.microsoft.com/v1.0';

const quandoPedir = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: {
    name: 'Quando pedirem um rascunho de resposta',
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'id_email', type: 'string' },
          { name: 'texto', type: 'string' },
          { name: 'referencia', type: 'string' },
        ],
      },
    },
    position: [0, 300],
  },
  output: [{ id_email: 'AAMkEmail', texto: 'Olá, Ana!\n\nO pedido sai amanhã.\n\nAtenciosamente,\nCarlos', referencia: '' }],
});

// Onde fica a assinatura: o e-mail que aparece embaixo da imagem e um trecho do nome da imagem no
// Google Drive (PNG, JPG ou GIF de até 1 MB; se houver mais de uma, vale a mais recente).
const assinatura = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Assinatura',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'as-email', name: 'email', value: '', type: 'string' },
          { id: 'as-imagem', name: 'imagem_drive', value: 'assinatura', type: 'string' },
          { id: 'as-largura', name: 'largura_maxima', value: 600, type: 'number' },
        ],
      },
      options: {},
    },
    position: [220, 300],
  },
  output: [{ email: 'dono@empresa.com.br', imagem_drive: 'assinatura', largura_maxima: 600 }],
});

// Procura no Google Drive a imagem mais recente (PNG, JPG ou GIF) com o trecho do nome. Sem ela, segue só com o e-mail.
const procurarImagem = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Procurar imagem da assinatura',
    parameters: {
      method: 'GET',
      url: 'https://www.googleapis.com/drive/v3/files',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleDriveOAuth2Api',
      sendQuery: true,
      specifyQuery: 'keypair',
      queryParameters: {
        parameters: [
          {
            name: 'q',
            value: expr(
              "{{ \"name contains '\" + String($json.imagem_drive).replace(/'/g, '') + \"' and trashed = false and (mimeType = 'image/png' or mimeType = 'image/jpeg' or mimeType = 'image/gif')\" }}",
            ),
          },
          { name: 'orderBy', value: 'modifiedTime desc' },
          { name: 'pageSize', value: '5' },
          { name: 'fields', value: 'files(id,name,mimeType,size,modifiedTime)' },
          { name: 'supportsAllDrives', value: 'true' },
          { name: 'includeItemsFromAllDrives', value: 'true' },
        ],
      },
      options: { timeout: 30000 },
    },
    credentials: { googleDriveOAuth2Api: credDrive },
    onError: 'continueRegularOutput',
    position: [440, 300],
  },
  output: [{ files: [{ id: 'img1', name: 'assinatura.png', mimeType: 'image/png', size: '20000', modifiedTime: '2026-09-29T16:17:03.015Z' }] }],
});

// Só baixa se achou uma imagem de até 1 MB (maior que isso, "Montar resposta" explica e segue só com o e-mail).
const achouImagem = ifElse({
  version: 2.3,
  config: {
    name: 'Achou a imagem?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          {
            id: 'cond-achou',
            leftValue: expr('{{ Array.isArray($json.files) && $json.files.length > 0 && Number($json.files[0].size || 0) <= 1048576 }}'),
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
    position: [660, 300],
  },
});

const baixarImagem = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Baixar imagem da assinatura',
    parameters: {
      method: 'GET',
      url: expr("{{ 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent($json.files[0].id) + '?alt=media' }}"),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleDriveOAuth2Api',
      options: { timeout: 30000, response: { response: { responseFormat: 'file', outputPropertyName: 'data' } } },
    },
    credentials: { googleDriveOAuth2Api: credDrive },
    onError: 'continueRegularOutput',
    position: [880, 200],
  },
  output: [{}],
});

const imagemEmBase64 = node({
  type: 'n8n-nodes-base.extractFromFile',
  version: 1.1,
  config: {
    name: 'Imagem em base64',
    parameters: { operation: 'binaryToPropery', binaryPropertyName: 'data', destinationKey: 'imagem_base64', options: {} },
    onError: 'continueRegularOutput',
    position: [1100, 200],
  },
  output: [{ imagem_base64: 'iVBORw0KGgo=' }],
});

const montarResposta = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar resposta',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Monta o texto do rascunho de resposta com a assinatura do dono: a imagem (um arquivo no Google Drive,\n// achado pelo nome) e o e-mail logo abaixo. Sem a imagem, a assinatura sai só com o e-mail e um aviso.\nconst pedido = $('Quando pedirem um rascunho de resposta').first().json;\nconst assinatura = $('Assinatura').first().json;\nconst busca = $('Procurar imagem da assinatura').first().json;\nconst baixada = $input.first().json;\n\nconst idEmail = String(pedido.id_email ?? '').trim();\nconst texto = String(pedido.texto ?? '').trim();\nif (!idEmail) throw new Error('Faltou o id do e-mail a responder.');\nif (!texto) throw new Error('Faltou o texto da resposta.');\n\nconst escapar = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');\nconst mensagemDe = (erro) => String(erro?.message ?? erro ?? '').slice(0, 120);\n\n// Largura e altura lidas do cabeçalho da imagem (PNG, GIF ou JPG), para ela não aparecer gigante.\nfunction medidas(buf) {\n  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) return { largura: buf.readUInt32BE(16), altura: buf.readUInt32BE(20) };\n  if (buf.length >= 10 && buf.toString('ascii', 0, 3) === 'GIF') return { largura: buf.readUInt16LE(6), altura: buf.readUInt16LE(8) };\n  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {\n    let i = 2;\n    while (i + 9 < buf.length) {\n      if (buf[i] !== 0xff) return { largura: 0, altura: 0 };\n      const marca = buf[i + 1];\n      if (marca === 0xff) {\n        i++;\n        continue;\n      }\n      if (marca >= 0xc0 && marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8 && marca !== 0xcc) {\n        return { altura: buf.readUInt16BE(i + 5), largura: buf.readUInt16BE(i + 7) };\n      }\n      i += 2 + buf.readUInt16BE(i + 2);\n    }\n  }\n  return { largura: 0, altura: 0 };\n}\n\nconst TIPOS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif' };\nconst CID = 'assinatura-kira';\nconst LIMITE = 1024 * 1024;\nconst arquivo = Array.isArray(busca.files) ? busca.files[0] : null;\nconst tipo = String(arquivo?.mimeType ?? '').toLowerCase();\nlet imagem = null;\nlet aviso = '';\nif (!arquivo) {\n  aviso = busca.error\n    ? `não consegui procurar a imagem da assinatura no Google Drive (${mensagemDe(busca.error)}), então a assinatura saiu só com o e-mail`\n    : `não achei no Google Drive a imagem da assinatura (PNG, JPG ou GIF com \"${assinatura.imagem_drive}\" no nome), então a assinatura saiu só com o e-mail`;\n} else if (!TIPOS[tipo]) {\n  aviso = 'a imagem da assinatura precisa ser PNG, JPG ou GIF, então a assinatura saiu só com o e-mail';\n} else if (Number(arquivo.size) > LIMITE) {\n  aviso = 'a imagem da assinatura passa de 1 MB, então a assinatura saiu só com o e-mail';\n} else if (!baixada.imagem_base64) {\n  aviso = `não consegui baixar a imagem da assinatura do Google Drive${baixada.error ? ` (${mensagemDe(baixada.error)})` : ''}, então a assinatura saiu só com o e-mail`;\n} else {\n  const buf = Buffer.from(baixada.imagem_base64, 'base64');\n  const { largura, altura } = medidas(buf);\n  const maxima = Number(assinatura.largura_maxima) || 600;\n  const escala = largura > maxima ? maxima / largura : 1;\n  imagem = {\n    nome: `assinatura.${TIPOS[tipo]}`,\n    tipo: tipo === 'image/jpg' ? 'image/jpeg' : tipo,\n    base64: buf.toString('base64'),\n    largura: Math.round(largura * escala),\n    altura: Math.round(altura * escala),\n  };\n}\n\nconst email = String(assinatura.email ?? '').trim();\nconst partes = [];\nif (imagem) {\n  const tamanho = imagem.largura && imagem.altura ? ` width=\"${imagem.largura}\" height=\"${imagem.altura}\"` : '';\n  partes.push(`<img src=\"cid:${CID}\" alt=\"Assinatura\"${tamanho} style=\"border:0\">`);\n}\nif (email) partes.push(`<a href=\"mailto:${escapar(email)}\">${escapar(email)}</a>`);\nconst comentario = escapar(texto).replace(/\\r?\\n/g, '<br>') + (partes.length ? '<br><br>' + partes.join('<br>') : '');\n\nreturn [{ json: { id_email: idEmail, referencia: String(pedido.referencia ?? ''), comentario, cid: CID, imagem, aviso } }];\n" },
    onError: 'continueErrorOutput',
    position: [1320, 300],
  },
  output: [{ id_email: 'AAMkEmail', referencia: '', comentario: 'Olá, Ana!<br><br><img src="cid:assinatura-kira">', cid: 'assinatura-kira', imagem: { nome: 'assinatura.png', tipo: 'image/png', base64: 'iVBORw0KGgo=', largura: 600, altura: 150 }, aviso: '' }],
});

// Cria o rascunho com o e-mail original citado embaixo (como o botão Responder do Outlook).
const criarRascunho = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Criar rascunho',
    parameters: {
      method: 'POST',
      url: expr("{{ '" + GRAPH + "/me/messages/' + encodeURIComponent($json.id_email) + '/createReply' }}"),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'microsoftOutlookOAuth2Api',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ comment: $json.comentario }) }}'),
      options: { timeout: 30000 },
    },
    credentials: { microsoftOutlookOAuth2Api: credOutlook },
    onError: 'continueErrorOutput',
    position: [1540, 300],
  },
  output: [{ id: 'AAMkRascunho', webLink: 'https://outlook.office365.com/owa/?ItemID=AAMkRascunho', isDraft: true }],
});

const temImagem = ifElse({
  version: 2.3,
  config: {
    name: 'Tem imagem?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          { id: 'cond-imagem', leftValue: expr("{{ Boolean($('Montar resposta').first().json.imagem) }}"), rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } },
        ],
        combinator: 'and',
      },
      options: {},
    },
    position: [1760, 300],
  },
});

// A imagem vai como anexo "embutido" (inline), que o corpo do e-mail mostra pelo cid.
const anexarImagem = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Anexar imagem da assinatura',
    parameters: {
      method: 'POST',
      url: expr("{{ '" + GRAPH + "/me/messages/' + encodeURIComponent($json.id) + '/attachments' }}"),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'microsoftOutlookOAuth2Api',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr(
        "{{ JSON.stringify({ '@odata.type': '#microsoft.graph.fileAttachment', name: $('Montar resposta').first().json.imagem.nome, contentType: $('Montar resposta').first().json.imagem.tipo, contentBytes: $('Montar resposta').first().json.imagem.base64, isInline: true, contentId: $('Montar resposta').first().json.cid }) }}",
      ),
      options: { timeout: 60000 },
    },
    credentials: { microsoftOutlookOAuth2Api: credOutlook },
    onError: 'continueRegularOutput',
    position: [1980, 200],
  },
  output: [{ id: 'AAMkAnexo', name: 'assinatura.png', contentType: 'image/png', isInline: true }],
});

const rascunhoPronto = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Rascunho pronto',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Resposta final: o rascunho criado (id e link) e como a assinatura ficou.\nconst montado = $('Montar resposta').first().json;\nconst rascunho = $('Criar rascunho').first().json;\nlet assinatura = montado.imagem ? 'imagem e e-mail' : 'só o e-mail';\nlet aviso = montado.aviso || '';\nif (montado.imagem) {\n  const anexo = $input.first().json;\n  if (!anexo.id || anexo.error) {\n    assinatura = 'só o e-mail';\n    aviso = 'não consegui colocar a imagem da assinatura no rascunho; confira antes de enviar';\n  }\n}\nreturn [\n  {\n    json: {\n      ok: true,\n      id: rascunho.id,\n      webLink: rascunho.webLink,\n      isDraft: true,\n      referencia: montado.referencia,\n      assinatura,\n      aviso,\n      mensagem:\n        `Rascunho criado na pasta Rascunhos do Outlook, com a assinatura (${assinatura}). Nada foi enviado: o dono revisa e envia.` +\n        (aviso ? ` Atenção: ${aviso}.` : ''),\n    },\n  },\n];\n" },
    position: [2200, 300],
  },
  output: [{ ok: true, id: 'AAMkRascunho', webLink: 'https://outlook.office365.com/owa/?ItemID=AAMkRascunho', isDraft: true, referencia: '', assinatura: 'imagem e e-mail', aviso: '', mensagem: 'Rascunho criado.' }],
});

const explicarFalha = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Explicar falha',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Falha ao montar ou criar o rascunho: devolve o motivo em poucas palavras (a Kira explica ao dono;\n// os rascunhos automáticos registram e avisam).\nconst falha = $input.first().json;\nconst erro = String(falha.error?.message ?? falha.error ?? 'erro desconhecido').slice(0, 300);\nlet referencia = '';\ntry {\n  referencia = String($('Quando pedirem um rascunho de resposta').first().json.referencia ?? '');\n} catch (e) {}\nlet orientacao = 'Não consegui criar o rascunho. Explique o erro ao dono em poucas palavras.';\nif (/404|not ?found|ItemNotFound/i.test(erro)) {\n  orientacao = 'Não achei esse e-mail no Outlook (o id pode estar errado ou o e-mail foi apagado). Busque o e-mail de novo e use o id que vier.';\n} else if (/401|403|unauthori[sz]ed|forbidden|token/i.test(erro)) {\n  orientacao = 'A conexão com o Outlook precisa ser refeita no n8n (credencial Microsoft Outlook). Explique isso ao dono.';\n}\nreturn [{ json: { ok: false, error: erro, referencia, orientacao } }];\n" },
    position: [1760, 560],
  },
  output: [{ ok: false, error: 'erro', referencia: '', orientacao: 'Explique o erro ao dono.' }],
});

export default workflow('kira-rascunho-resposta', 'Kira — rascunho de resposta com assinatura (ferramenta)', { executionOrder: 'v1', timezone: 'America/Sao_Paulo' })
  .add(quandoPedir)
  .to(assinatura)
  .to(procurarImagem)
  .to(achouImagem.onTrue(baixarImagem.to(imagemEmBase64).to(montarResposta)).onFalse(montarResposta))
  .add(montarResposta)
  .to(criarRascunho)
  .to(temImagem.onTrue(anexarImagem.to(rascunhoPronto)).onFalse(rascunhoPronto))
  .add(montarResposta.onError(explicarFalha))
  .add(criarRascunho.onError(explicarFalha));
