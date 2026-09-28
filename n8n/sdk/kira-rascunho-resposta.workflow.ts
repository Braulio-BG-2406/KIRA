// Kira — rascunho de resposta: cria o RASCUNHO de resposta de um e-mail do Outlook com a assinatura
// do dono (a imagem guardada no OneDrive e o e-mail logo abaixo). Usado pela ferramenta
// criar_rascunho_resposta da Kira e pelos rascunhos automáticos. Nunca envia nada.
import { workflow, node, trigger, ifElse, expr, newCredential } from '@n8n/workflow-sdk';

const credOutlook = newCredential('Microsoft Outlook account');
const credMicrosoft = newCredential('Microsoft (OneDrive)');
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
  output: [{ id_email: 'AAMkEmail', texto: 'Olá, Ana!\n\nO pedido sai amanhã.\n\nAtenciosamente,\nBráulio', referencia: '' }],
});

// Onde fica a assinatura: o e-mail que aparece embaixo da imagem e o caminho da imagem no OneDrive.
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
          { id: 'as-imagem', name: 'imagem_onedrive', value: 'Kira/assinatura.png', type: 'string' },
          { id: 'as-largura', name: 'largura_maxima', value: 600, type: 'number' },
        ],
      },
      options: {},
    },
    position: [220, 300],
  },
  output: [{ email: 'dono@empresa.com.br', imagem_onedrive: 'Kira/assinatura.png', largura_maxima: 600 }],
});

// Dados da imagem no OneDrive (inclui um link de download temporário). Sem a imagem, segue só com o e-mail.
const imagemDaAssinatura = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Imagem da assinatura',
    parameters: {
      method: 'GET',
      url: expr("{{ '" + GRAPH + "/me/drive/root:/' + String($json.imagem_onedrive).split('/').map(encodeURIComponent).join('/') }}"),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'microsoftTeamsOAuth2Api',
      options: { timeout: 30000 },
    },
    credentials: { microsoftTeamsOAuth2Api: credMicrosoft },
    onError: 'continueRegularOutput',
    position: [440, 300],
  },
  output: [{ name: 'assinatura.png', size: 20000, file: { mimeType: 'image/png' }, '@microsoft.graph.downloadUrl': 'https://exemplo/assinatura.png' }],
});

const montarResposta = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar resposta',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Monta o texto do rascunho de resposta com a assinatura do dono: a imagem (um arquivo no OneDrive)\n// e o e-mail logo abaixo. Sem a imagem no OneDrive, a assinatura sai só com o e-mail.\nconst pedido = $('Quando pedirem um rascunho de resposta').first().json;\nconst assinatura = $('Assinatura').first().json;\nconst info = $input.first().json;\n\nconst idEmail = String(pedido.id_email ?? '').trim();\nconst texto = String(pedido.texto ?? '').trim();\nif (!idEmail) throw new Error('Faltou o id do e-mail a responder.');\nif (!texto) throw new Error('Faltou o texto da resposta.');\n\nconst escapar = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');\n\n// Largura e altura lidas do cabeçalho da imagem (PNG, GIF ou JPG), para ela não aparecer gigante.\nfunction medidas(buf) {\n  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) return { largura: buf.readUInt32BE(16), altura: buf.readUInt32BE(20) };\n  if (buf.length >= 10 && buf.toString('ascii', 0, 3) === 'GIF') return { largura: buf.readUInt16LE(6), altura: buf.readUInt16LE(8) };\n  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {\n    let i = 2;\n    while (i + 9 < buf.length) {\n      if (buf[i] !== 0xff) return { largura: 0, altura: 0 };\n      const marca = buf[i + 1];\n      if (marca === 0xff) {\n        i++;\n        continue;\n      }\n      if (marca >= 0xc0 && marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8 && marca !== 0xcc) {\n        return { altura: buf.readUInt16BE(i + 5), largura: buf.readUInt16BE(i + 7) };\n      }\n      i += 2 + buf.readUInt16BE(i + 2);\n    }\n  }\n  return { largura: 0, altura: 0 };\n}\n\nconst TIPOS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif' };\nconst CID = 'assinatura-kira';\nlet imagem = null;\nlet aviso = '';\nconst link = info['@microsoft.graph.downloadUrl'];\nconst tipo = String(info.file?.mimeType ?? '').toLowerCase();\nif (!link) {\n  aviso = `não achei a imagem da assinatura no OneDrive (${assinatura.imagem_onedrive}), então a assinatura saiu só com o e-mail`;\n} else if (!TIPOS[tipo]) {\n  aviso = 'a imagem da assinatura precisa ser PNG, JPG ou GIF, então a assinatura saiu só com o e-mail';\n} else if (Number(info.size) > 1024 * 1024) {\n  aviso = 'a imagem da assinatura passa de 1 MB, então a assinatura saiu só com o e-mail';\n} else {\n  try {\n    const buf = Buffer.from(await this.helpers.httpRequest({ url: link, encoding: 'arraybuffer', timeout: 30000 }));\n    const { largura, altura } = medidas(buf);\n    const maxima = Number(assinatura.largura_maxima) || 600;\n    const escala = largura > maxima ? maxima / largura : 1;\n    imagem = {\n      nome: `assinatura.${TIPOS[tipo]}`,\n      tipo: tipo === 'image/jpg' ? 'image/jpeg' : tipo,\n      base64: buf.toString('base64'),\n      largura: Math.round(largura * escala),\n      altura: Math.round(altura * escala),\n    };\n  } catch (erro) {\n    aviso = `não consegui baixar a imagem da assinatura (${String(erro.message ?? erro).slice(0, 120)}), então a assinatura saiu só com o e-mail`;\n  }\n}\n\nconst email = String(assinatura.email ?? '').trim();\nconst partes = [];\nif (imagem) {\n  const tamanho = imagem.largura && imagem.altura ? ` width=\"${imagem.largura}\" height=\"${imagem.altura}\"` : '';\n  partes.push(`<img src=\"cid:${CID}\" alt=\"Assinatura\"${tamanho} style=\"border:0\">`);\n}\nif (email) partes.push(`<a href=\"mailto:${escapar(email)}\">${escapar(email)}</a>`);\nconst comentario = escapar(texto).replace(/\\r?\\n/g, '<br>') + (partes.length ? '<br><br>' + partes.join('<br>') : '');\n\nreturn [{ json: { id_email: idEmail, referencia: String(pedido.referencia ?? ''), comentario, cid: CID, imagem, aviso } }];\n" },
    onError: 'continueErrorOutput',
    position: [660, 300],
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
    position: [880, 300],
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
    position: [1100, 300],
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
    position: [1320, 200],
  },
  output: [{ id: 'AAMkAnexo', name: 'assinatura.png', contentType: 'image/png', isInline: true }],
});

const rascunhoPronto = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Rascunho pronto',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Resposta final: o rascunho criado (id e link) e como a assinatura ficou.\nconst montado = $('Montar resposta').first().json;\nconst rascunho = $('Criar rascunho').first().json;\nlet assinatura = montado.imagem ? 'imagem e e-mail' : 'só o e-mail';\nlet aviso = montado.aviso || '';\nif (montado.imagem) {\n  const anexo = $input.first().json;\n  if (!anexo.id || anexo.error) {\n    assinatura = 'só o e-mail';\n    aviso = 'não consegui colocar a imagem da assinatura no rascunho; confira antes de enviar';\n  }\n}\nreturn [\n  {\n    json: {\n      ok: true,\n      id: rascunho.id,\n      webLink: rascunho.webLink,\n      isDraft: true,\n      referencia: montado.referencia,\n      assinatura,\n      aviso,\n      mensagem:\n        `Rascunho criado na pasta Rascunhos do Outlook, com a assinatura (${assinatura}). Nada foi enviado: o dono revisa e envia.` +\n        (aviso ? ` Atenção: ${aviso}.` : ''),\n    },\n  },\n];\n" },
    position: [1540, 300],
  },
  output: [{ ok: true, id: 'AAMkRascunho', webLink: 'https://outlook.office365.com/owa/?ItemID=AAMkRascunho', isDraft: true, referencia: '', assinatura: 'imagem e e-mail', aviso: '', mensagem: 'Rascunho criado.' }],
});

const explicarFalha = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Explicar falha',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Falha ao montar ou criar o rascunho: devolve o motivo em poucas palavras (a Kira explica ao dono;\n// os rascunhos automáticos registram e avisam).\nconst falha = $input.first().json;\nconst erro = String(falha.error?.message ?? falha.error ?? 'erro desconhecido').slice(0, 300);\nlet referencia = '';\ntry {\n  referencia = String($('Quando pedirem um rascunho de resposta').first().json.referencia ?? '');\n} catch (e) {}\nlet orientacao = 'Não consegui criar o rascunho. Explique o erro ao dono em poucas palavras.';\nif (/404|not ?found|ItemNotFound/i.test(erro)) {\n  orientacao = 'Não achei esse e-mail no Outlook (o id pode estar errado ou o e-mail foi apagado). Busque o e-mail de novo e use o id que vier.';\n} else if (/401|403|unauthori[sz]ed|forbidden|token/i.test(erro)) {\n  orientacao = 'A conexão com o Outlook precisa ser refeita no n8n (credencial Microsoft Outlook). Explique isso ao dono.';\n}\nreturn [{ json: { ok: false, error: erro, referencia, orientacao } }];\n" },
    position: [1100, 560],
  },
  output: [{ ok: false, error: 'erro', referencia: '', orientacao: 'Explique o erro ao dono.' }],
});

export default workflow('kira-rascunho-resposta', 'Kira — rascunho de resposta com assinatura (ferramenta)', { executionOrder: 'v1', timezone: 'America/Sao_Paulo' })
  .add(quandoPedir)
  .to(assinatura)
  .to(imagemDaAssinatura)
  .to(montarResposta)
  .to(criarRascunho)
  .to(temImagem.onTrue(anexarImagem.to(rascunhoPronto)).onFalse(rascunhoPronto))
  .add(montarResposta.onError(explicarFalha))
  .add(criarRascunho.onError(explicarFalha));
