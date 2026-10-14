import { workflow, node, trigger, ifElse, expr, newCredential } from '@n8n/workflow-sdk';

// ID do Telegram do dono (o mesmo de ids_autorizados no nó "Configuração da Kira" da Kira 2.0).
const DONO_TELEGRAM = 'SEU_ID_DO_TELEGRAM';

const todoDia = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.4,
  config: {
    name: 'Todo dia às 6h52',
    parameters: { rule: { interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 6, triggerAtMinute: 52 }] } },
  },
});

const rodarAgora = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Rodar agora' } });

const prepararLogin = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Preparar login',
    executeOnce: true,
    parameters: {
      jsCode: `// Cabeçalhos que a tela de login da empresa (infinitejs.marketup.com) manda: o token público de visitante e o domínio da conta.
return [{ json: { visitante: 'eyJBdXRoU2Vzc2lvbklEIjoiNEQ1RjgxQkYtREU4My00MzdDLUIyN0UtQ0QwNjVEQzJBRTY5In0=', dominio: Buffer.from('infinitejs:2522208').toString('base64') } }];
`,
    },
  },
});

const entrar = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Entrar no MarketUP',
    parameters: {
      method: 'POST',
      url: 'https://api-erp.marketup.com/v1/auth/authenticate-user',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpCustomAuth',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Authorization', value: expr('Bearer {{ $json.visitante }}') },
          { name: 'x-auth-token', value: expr('{{ $json.dominio }}') },
        ],
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr("{{ JSON.stringify({ Domain: 'infinitejs', LoginType: 1, SendDate: $now.toISO() }) }}"),
      options: { timeout: 60000 },
    },
    credentials: { httpCustomAuth: newCredential('MarketUP (Infinite)') },
  },
});

const listarPastas = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Ver arquivos das pastas',
    parameters: {
      url: 'https://www.googleapis.com/drive/v3/files',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleDriveOAuth2Api',
      sendQuery: true,
      queryParameters: {
        parameters: [
          { name: 'q', value: "('1OpDiiLtm27IJV19HbP8v08k4CQDSC5u0' in parents or '1US2chBVlCiX0FFxMrx-SaqhO4BmT16_6' in parents or '1i_W1E2oC0U6YZplEtZZzXmTiQllGzxT4' in parents or '1yigxG4E6OKuIooXs5_nBuhLUyz36bWBn' in parents) and trashed = false and mimeType != 'application/vnd.google-apps.folder'" },
          { name: 'fields', value: 'files(id,name,parents,modifiedTime)' },
          { name: 'pageSize', value: '100' },
        ],
      },
      options: { timeout: 30000 },
    },
    credentials: { googleDriveOAuth2Api: newCredential('Google Drive account') },
  },
});

const baixar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Baixar e conferir relatórios',
    parameters: {
      jsCode: `// Baixa do MarketUP os 4 relatórios que a BD INFINITE lê, do início da loja (01/06/2024) até agora,
// do mesmo jeito que o botão "Exportar > Excel" do site, e confere o formato antes de trocar qualquer arquivo.
// Se um relatório vier errado, para tudo: nenhum arquivo da pasta JOIAS é trocado.
// Pastas do computador da Janaína sincronizadas no Google Drive (Computadores > Meu laptop > JOIAS > BD INFINITE V2).
// A planilha "Nova BD INFINITE v3.xlsx" lê (Power Query) todos os arquivos de cada uma destas pastas.
// Se mudar uma pasta, troque o ID aqui e no passo "Ver arquivos das pastas".
const PASTAS = {
  RelatorioCarteiraClientes: '1OpDiiLtm27IJV19HbP8v08k4CQDSC5u0',
  RelatorioVendasTotais: '1US2chBVlCiX0FFxMrx-SaqhO4BmT16_6',
  RelatorioVendasVendedor: '1i_W1E2oC0U6YZplEtZZzXmTiQllGzxT4',
  RelatorioEstoqueLocalizacaoStatus: '1yigxG4E6OKuIooXs5_nBuhLUyz36bWBn',
};
const RELATORIOS = [
  { pasta: 'RelatorioCarteiraClientes', endereco: 'ReportFinancial/ExportReportFinancialPersonPortfolio', periodo: true, extra: {} },
  { pasta: 'RelatorioVendasTotais', endereco: 'ReportSale/ExportReportSaleByTotal', periodo: true, extra: { Erp: true, Pdv: true, Ecommerce: true, SortColumn: 'TotalPrice', SortDirection: 'DESC' } },
  { pasta: 'RelatorioVendasVendedor', endereco: 'ReportSale/ExportReportSaleBySeller', periodo: true, extra: { Pdv: true, Erp: true, Ecommerce: true, SortColumn: 'Total', SortDirection: 'DESC' } },
  // Estoque é a posição de hoje: o site exporta sem período.
  { pasta: 'RelatorioEstoqueLocalizacaoStatus', endereco: 'ReportStock/ExportReportStockLocationStatus', periodo: false, extra: {} },
];
const INICIO = '2024-06-01T03:00:00.000Z'; // 01/06/2024 00:00 em São Paulo

const acharCampo = (valor, regra, profundidade = 0) => {
  if (!valor || typeof valor !== 'object' || profundidade > 5) return null;
  for (const [chave, v] of Object.entries(valor)) if (regra.test(chave) && (typeof v === 'string' || typeof v === 'number') && v !== '') return v;
  for (const v of Object.values(valor)) { const achado = acharCampo(v, regra, profundidade + 1); if (achado) return achado; }
  return null;
};
const login = $('Entrar no MarketUP').first().json;
const token = acharCampo(login, /^AuthToken$/i);
if (!token) throw new Error('O MarketUP não aceitou o login da Kira (sem AuthToken). Confira a credencial "MarketUP (Infinite)" no n8n.');
const installId = acharCampo(login, /^InstallID$/i) || 2522208;
const validade = DateTime.now().plus({ seconds: Number(acharCampo(login, /^AuthTokenExpireIn$/i)) || 7200 }).toISO();
// O site manda o cookie "authorization" (token|validade|domínio) e o domínio da conta junto com o endereço de download.
const cabecalhos = {
  Cookie: 'authorization=' + encodeURIComponent(token + '|' + validade + '|infinitejs'),
  'x-auth-token': Buffer.from('infinitejs:' + installId).toString('base64'),
};

// Nome das abas de um .xls (Excel 97-2003): registro BOUNDSHEET.
const abasXls = (buf) => {
  const nomes = [];
  for (let i = 0; i < buf.length - 12 && nomes.length < 5; i++) {
    if (buf[i] !== 0x85 || buf[i + 1] !== 0x00) continue;
    const len = buf.readUInt16LE(i + 2);
    const cch = buf[i + 10];
    const alto = buf[i + 11];
    if (cch < 1 || (alto !== 0 && alto !== 1) || len !== 8 + (alto ? cch * 2 : cch)) continue;
    nomes.push(alto ? buf.slice(i + 12, i + 12 + cch * 2).toString('utf16le') : buf.slice(i + 12, i + 12 + cch).toString('latin1'));
  }
  return nomes;
};

const arquivosNoDrive = $input.first().json.files || [];
const fim = new Date().toISOString();
const saida = [];
for (const r of RELATORIOS) {
  const pedido = { FileType: 'xls', ...(r.periodo ? { StartDate: INICIO, EndDate: fim } : {}), ...r.extra, CookieName: 'download_' + DateTime.now().toFormat('yyyy_MM_dd_HH_mm_ss_SSS') };
  const url = 'https://api-erp.marketup.com/v1/' + r.endereco + '?authorization=' + encodeURIComponent(token) + '&request=' + encodeURIComponent(Buffer.from(JSON.stringify(pedido), 'utf8').toString('base64'));
  const resposta = await this.helpers.httpRequest({ url, headers: cabecalhos, encoding: 'arraybuffer', returnFullResponse: true, ignoreHttpStatusErrors: true, timeout: 300000 });
  const buf = Buffer.from(resposta.body);
  if (resposta.statusCode !== 200 || buf.slice(0, 4).toString('hex') !== 'd0cf11e0') {
    throw new Error('O MarketUP não entregou o relatório ' + r.pasta + ' (status ' + resposta.statusCode + '): ' + buf.slice(0, 200).toString('utf8'));
  }
  const abas = abasXls(buf);
  if (!abas.includes('Plan 1')) throw new Error('O relatório ' + r.pasta + ' veio sem a aba "Plan 1" (abas: ' + abas.join(', ') + '). A planilha não ia conseguir ler.');

  // Arquivo que vai ser trocado: o de mesmo nome; senão, o único .xls da pasta. Sem nenhum, cria um novo.
  const pastaId = PASTAS[r.pasta];
  const naPasta = arquivosNoDrive.filter((f) => (f.parents || []).includes(pastaId));
  const xls = naPasta.filter((f) => /\\.xls$/i.test(f.name));
  const alvo = naPasta.find((f) => f.name === r.pasta + '.xls') || (xls.length === 1 ? xls[0] : null);
  const outros = naPasta.filter((f) => !alvo || f.id !== alvo.id).map((f) => f.name);
  saida.push({
    json: {
      pasta: r.pasta,
      pastaId,
      arquivoId: alvo ? alvo.id : '',
      nomeArquivo: alvo ? alvo.name : r.pasta + '.xls',
      tamanho_kb: Math.round(buf.length / 1024),
      aviso: outros.length ? 'A pasta ' + r.pasta + ' tem outros arquivos (' + outros.join(', ') + '): a planilha soma todos. Deixe só ' + r.pasta + '.xls.' : '',
    },
    binary: { data: { data: buf.toString('base64'), mimeType: 'application/vnd.ms-excel', fileName: r.pasta + '.xls', fileExtension: 'xls' } },
  });
}
return saida;
`,
    },
  },
});

const jaTem = ifElse({
  version: 2.2,
  config: {
    name: 'Já tem o arquivo na pasta?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.arquivoId }}'), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }],
        combinator: 'and',
      },
    },
  },
});

const trocar = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Trocar o conteúdo do arquivo',
    parameters: {
      resource: 'file',
      operation: 'update',
      fileId: { __rl: true, mode: 'id', value: expr('{{ $json.arquivoId }}') },
      changeFileContent: true,
      inputDataFieldName: 'data',
      options: {},
    },
    credentials: { googleDriveOAuth2Api: newCredential('Google Drive account') },
  },
});

const criar = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Criar o arquivo na pasta',
    parameters: {
      resource: 'file',
      operation: 'upload',
      inputDataFieldName: 'data',
      name: expr('{{ $json.pasta }}.xls'),
      driveId: { __rl: true, mode: 'list', value: 'My Drive' },
      folderId: { __rl: true, mode: 'id', value: expr('{{ $json.pastaId }}') },
      options: {},
    },
    credentials: { googleDriveOAuth2Api: newCredential('Google Drive account') },
  },
});

const seDerErro = trigger({ type: 'n8n-nodes-base.errorTrigger', version: 1, config: { name: 'Se der erro' } });

const avisar = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Avisar no Telegram',
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: DONO_TELEGRAM,
      text: expr("{{ '⚠️ Não consegui atualizar os relatórios da BD INFINITE (' + $now.setZone('America/Sao_Paulo').toFormat('dd/MM HH:mm') + ').\\n\\nMotivo: ' + String($json.execution?.error?.message || 'erro desconhecido').slice(0, 300).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '\\n\\nOs arquivos da pasta JOIAS ficaram como estavam. Se for o login, confira a credencial \"MarketUP (Infinite)\" no n8n.' }}"),
      additionalFields: { appendAttribution: false, parse_mode: 'HTML' },
    },
    credentials: { telegramApi: newCredential('Telegram account') },
  },
});

export default workflow('atualizar-relatorios-bd-infinite', 'Kira — atualizar relatórios da BD INFINITE')
  .add(todoDia)
  .to(prepararLogin)
  .add(rodarAgora)
  .to(prepararLogin)
  .add(prepararLogin)
  .to(entrar)
  .to(listarPastas)
  .to(baixar)
  .to(jaTem.onTrue(trocar).onFalse(criar))
  .add(seDerErro)
  .to(avisar)
  .group('Buscar no MarketUP', [prepararLogin, entrar, listarPastas, baixar], {
    description: 'Entra no MarketUP, baixa os 4 relatórios (01/06/2024 até hoje) e confere o formato antes de mexer na pasta',
  })
  .group('Gravar na pasta JOIAS', [jaTem, trocar, criar], {
    description: 'Troca o conteúdo de cada RelatorioX.xls no Drive; o Drive do computador baixa sozinho para a pasta da planilha',
  });
