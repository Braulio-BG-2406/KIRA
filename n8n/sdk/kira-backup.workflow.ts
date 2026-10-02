// Kira — Backup semanal: todo domingo às 3h junta as tabelas da Kira (memórias, tarefas, contatos, histórico...)
// num arquivo JSON e guarda na pasta "Kira - backups" do Google Drive. Fica com os 8 mais recentes; os mais antigos vão
// para a lixeira do Drive. Se algo falhar, a Saúde da Kira avisa no Telegram.
import { workflow, node, trigger, ifElse, expr, newCredential } from '@n8n/workflow-sdk';

const domingo = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.2,
  config: {
    name: 'Domingo às 3h',
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 3 * * 0' }] } },
    position: [0, 300],
  },
  output: [{ timestamp: '2026-10-04T03:00:00.000-03:00' }],
});

const configuracao = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Configuração do backup',
    parameters: {
      assignments: {
        assignments: [
          { id: 'b-pasta', name: 'pasta', value: 'Kira - backups', type: 'string' },
          { id: 'b-manter', name: 'manter', value: 8, type: 'number' },
          { id: 'b-prefixo', name: 'prefixo', value: 'kira-backup-', type: 'string' },
          { id: 'b-hoje', name: 'hoje', value: expr("{{ $now.setZone('America/Sao_Paulo').toFormat('yyyy-MM-dd') }}"), type: 'string' },
        ],
      },
      options: {},
    },
    position: [220, 300],
  },
  output: [{ pasta: 'Kira - backups', manter: 8, prefixo: 'kira-backup-', hoje: '2026-10-04' }],
});

const lerConfig = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: "Ler kira_config",
    parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'name', value: "kira_config" }, returnAll: true },
    alwaysOutputData: true,
    executeOnce: true,
    onError: 'continueRegularOutput',
    position: [440, 300],
  },
  output: [{ id: 1 }],
});

const lerMemoria = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: "Ler kira_memoria",
    parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'name', value: "kira_memoria" }, returnAll: true },
    alwaysOutputData: true,
    executeOnce: true,
    onError: 'continueRegularOutput',
    position: [640, 300],
  },
  output: [{ id: 1 }],
});

const lerTarefas = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: "Ler kira_tarefas",
    parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'name', value: "kira_tarefas" }, returnAll: true },
    alwaysOutputData: true,
    executeOnce: true,
    onError: 'continueRegularOutput',
    position: [840, 300],
  },
  output: [{ id: 1 }],
});

const lerContatos = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: "Ler kira_contatos",
    parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'name', value: "kira_contatos" }, returnAll: true },
    alwaysOutputData: true,
    executeOnce: true,
    onError: 'continueRegularOutput',
    position: [1040, 300],
  },
  output: [{ id: 1 }],
});

const lerLogs = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: "Ler kira_logs",
    parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'name', value: "kira_logs" }, returnAll: true },
    alwaysOutputData: true,
    executeOnce: true,
    onError: 'continueRegularOutput',
    position: [1240, 300],
  },
  output: [{ id: 1 }],
});

const lerLinkedin = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: "Ler kira_linkedin",
    parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'name', value: "kira_linkedin" }, returnAll: true },
    alwaysOutputData: true,
    executeOnce: true,
    onError: 'continueRegularOutput',
    position: [1440, 300],
  },
  output: [{ id: 1 }],
});

const lerImagens = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: "Ler kira_imagens",
    parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'name', value: "kira_imagens" }, returnAll: true },
    alwaysOutputData: true,
    executeOnce: true,
    onError: 'continueRegularOutput',
    position: [1640, 300],
  },
  output: [{ id: 1 }],
});

const lerEmailsAuto = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: "Ler kira_emails_auto",
    parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'name', value: "kira_emails_auto" }, returnAll: true },
    alwaysOutputData: true,
    executeOnce: true,
    onError: 'continueRegularOutput',
    position: [1840, 300],
  },
  output: [{ id: 1 }],
});

const lerSaude = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: "Ler kira_saude",
    parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'name', value: "kira_saude" }, returnAll: true },
    alwaysOutputData: true,
    executeOnce: true,
    onError: 'continueRegularOutput',
    position: [2040, 300],
  },
  output: [{ id: 1 }],
});

const acharPasta = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Achar pasta',
    parameters: {
      url: 'https://www.googleapis.com/drive/v3/files',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleDriveOAuth2Api',
      sendQuery: true,
      queryParameters: {
        parameters: [
          { name: 'q', value: expr("{{ \"mimeType = 'application/vnd.google-apps.folder' and name = '\" + $('Configuração do backup').first().json.pasta + \"' and trashed = false\" }}") },
          { name: 'pageSize', value: '1' },
          { name: 'fields', value: 'files(id,name)' },
        ],
      },
      options: { timeout: 30000 },
    },
    credentials: { googleDriveOAuth2Api: newCredential('Google Drive') },
    executeOnce: true,
    position: [2240, 300],
  },
  output: [{ files: [{ id: 'pasta1', name: 'Kira - backups' }] }],
});

const pastaExiste = ifElse({
  version: 2.3,
  config: {
    name: 'Pasta já existe?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          { id: 'c-pasta', leftValue: expr("{{ ($json.files || []).length > 0 }}"), rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } },
        ],
        combinator: 'and',
      },
      options: {},
    },
    position: [2460, 300],
  },
});

const criarPasta = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Criar pasta',
    parameters: {
      method: 'POST',
      url: 'https://www.googleapis.com/drive/v3/files',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleDriveOAuth2Api',
      sendQuery: true,
      queryParameters: { parameters: [{ name: 'fields', value: 'id,name' }] },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr("{{ JSON.stringify({ name: $('Configuração do backup').first().json.pasta, mimeType: 'application/vnd.google-apps.folder' }) }}"),
      options: { timeout: 30000 },
    },
    credentials: { googleDriveOAuth2Api: newCredential('Google Drive') },
    executeOnce: true,
    position: [2680, 460],
  },
  output: [{ id: 'pasta1', name: 'Kira - backups' }],
});

const pastaDoBackup = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Pasta do backup',
    parameters: {
      assignments: {
        assignments: [{ id: 'p-id', name: 'pasta_id', value: expr("{{ $json.files ? $json.files[0].id : $json.id }}"), type: 'string' }],
      },
      options: {},
    },
    position: [2900, 300],
  },
  output: [{ pasta_id: 'pasta1' }],
});

const montar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar backup',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Junta as tabelas da Kira num arquivo JSON (a cópia de segurança da semana) e conta as linhas de cada uma.\n// Uma tabela que não abriu fica de fora e entra na lista de falhas; se nenhuma abrir, o backup para com erro.\nconst cfg = $('Configuração do backup').first().json;\nconst TABELAS = ['kira_config', 'kira_memoria', 'kira_tarefas', 'kira_contatos', 'kira_logs', 'kira_linkedin', 'kira_imagens', 'kira_emails_auto', 'kira_saude'];\nconst backup = { kira_backup: 1, gerado_em: new Date().toISOString(), tabelas: {} };\nconst linhas = {};\nconst falhas = [];\nfor (const nome of TABELAS) {\n  let itens;\n  try {\n    itens = $('Ler ' + nome).all().map((i) => i.json);\n  } catch (e) {\n    falhas.push(`${nome} (não rodou)`);\n    continue;\n  }\n  const comErro = itens.find((r) => r && r.error);\n  if (comErro) {\n    const e = comErro.error;\n    falhas.push(`${nome} (${String((e && e.message) || e).replace(/\\s+/g, ' ').slice(0, 80)})`);\n    continue;\n  }\n  // Tabela vazia: o n8n entrega um item vazio, que não entra no backup.\n  const registros = itens.filter((r) => r && r.id !== undefined);\n  backup.tabelas[nome] = registros;\n  linhas[nome] = registros.length;\n}\nif (!Object.keys(backup.tabelas).length) throw new Error('Não consegui ler nenhuma tabela da Kira: ' + falhas.join('; '));\nbackup.linhas = linhas;\nbackup.falhas = falhas;\nconst texto = JSON.stringify(backup);\nconst arquivo = `${cfg.prefixo || 'kira-backup-'}${cfg.hoje}.json`;\nreturn [\n  {\n    json: { arquivo, pasta_id: $('Pasta do backup').first().json.pasta_id, tamanho_kb: Math.round(Buffer.byteLength(texto) / 1024), linhas, falhas },\n    binary: { data: { data: Buffer.from(texto, 'utf8').toString('base64'), mimeType: 'application/json', fileName: arquivo } },\n  },\n];\n" },
    position: [3120, 300],
  },
  output: [{ arquivo: 'kira-backup-2026-10-04.json', pasta_id: 'pasta1', tamanho_kb: 10, linhas: {}, falhas: [] }],
});

const enviar = node({
  type: 'n8n-nodes-base.googleDrive',
  version: 3,
  config: {
    name: 'Guardar no Google Drive',
    parameters: {
      resource: 'file',
      operation: 'upload',
      inputDataFieldName: 'data',
      name: expr("{{ $json.arquivo }}"),
      driveId: { __rl: true, mode: 'list', value: 'My Drive' },
      folderId: { __rl: true, mode: 'id', value: expr("{{ $json.pasta_id }}") },
      options: {},
    },
    credentials: { googleDriveOAuth2Api: newCredential('Google Drive') },
    position: [3340, 300],
  },
  output: [{ id: 'arquivo1', name: 'kira-backup-2026-10-04.json' }],
});

const conferencia = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Conferência (só números)',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Confere o backup salvo. Se alguma tabela ficou de fora, o arquivo parcial fica no Google Drive, mas a execução\n// para com erro: a Saúde da Kira avisa no Telegram e os backups antigos não são apagados.\nconst b = $('Montar backup').first().json;\nconst salvo = $input.first().json;\nif (!salvo.id) throw new Error('O Google Drive não confirmou o arquivo do backup.');\nif (b.falhas.length) throw new Error(`Backup salvo sem estas tabelas: ${b.falhas.join('; ')}`);\nreturn [{ json: { arquivo: b.arquivo, tamanho_kb: b.tamanho_kb, linhas: b.linhas, tabelas: Object.keys(b.linhas).length } }];\n" },
    position: [3560, 300],
  },
  output: [{ arquivo: 'kira-backup-2026-10-04.json', tamanho_kb: 10, linhas: {}, tabelas: 9 }],
});

const backupsAntigos = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Backups da pasta',
    parameters: {
      url: 'https://www.googleapis.com/drive/v3/files',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleDriveOAuth2Api',
      sendQuery: true,
      queryParameters: {
        parameters: [
          { name: 'q', value: expr("{{ \"'\" + $('Pasta do backup').first().json.pasta_id + \"' in parents and name contains '\" + $('Configuração do backup').first().json.prefixo + \"' and trashed = false\" }}") },
          { name: 'orderBy', value: 'createdTime desc' },
          { name: 'pageSize', value: '100' },
          { name: 'fields', value: 'files(id,name,createdTime)' },
        ],
      },
      options: { timeout: 30000 },
    },
    credentials: { googleDriveOAuth2Api: newCredential('Google Drive') },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    executeOnce: true,
    position: [3780, 300],
  },
  output: [{ files: [] }],
});

const escolherAntigos = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Escolher os antigos',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Guarda os backups mais recentes (8 por padrão); os mais antigos vão para a lixeira do Google Drive, que os apaga\n// de vez depois de 30 dias. Só mexe em arquivos \"kira-backup-...\" da pasta de backups.\nconst manter = Math.max(Number($('Configuração do backup').first().json.manter) || 8, 1);\nconst arquivos = ($input.first().json.files ?? []).filter((f) => f && f.id && /^kira-backup-.*\\.json$/.test(String(f.name ?? '')));\narquivos.sort((a, b) => String(b.createdTime ?? '').localeCompare(String(a.createdTime ?? '')));\nreturn arquivos.slice(manter).map((f) => ({ json: { id: f.id, name: f.name } }));\n" },
    position: [4000, 300],
  },
  output: [{ id: 'antigo1', name: 'kira-backup-2026-08-02.json' }],
});

const lixeira = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Mandar para a lixeira',
    parameters: {
      method: 'PATCH',
      url: expr("{{ 'https://www.googleapis.com/drive/v3/files/' + $json.id }}"),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googleDriveOAuth2Api',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '{"trashed": true}',
      options: { timeout: 30000 },
    },
    credentials: { googleDriveOAuth2Api: newCredential('Google Drive') },
    onError: 'continueRegularOutput',
    position: [4220, 300],
  },
  output: [{ id: 'antigo1', trashed: true }],
});

export default workflow('kira-backup', 'Kira — Backup semanal (domingo 3h)', { executionOrder: 'v1', timezone: 'America/Sao_Paulo', saveDataSuccessExecution: 'none', saveDataErrorExecution: 'all' })
  .add(domingo)
  .to(configuracao)
  .to(lerConfig)
  .to(lerMemoria)
  .to(lerTarefas)
  .to(lerContatos)
  .to(lerLogs)
  .to(lerLinkedin)
  .to(lerImagens)
  .to(lerEmailsAuto)
  .to(lerSaude)
  .to(acharPasta)
  .to(pastaExiste.onTrue(pastaDoBackup).onFalse(criarPasta.to(pastaDoBackup)))
  .add(pastaDoBackup)
  .to(montar)
  .to(enviar)
  .to(conferencia)
  .to(backupsAntigos)
  .to(escolherAntigos)
  .to(lixeira);
