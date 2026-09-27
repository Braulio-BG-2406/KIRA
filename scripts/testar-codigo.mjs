// Testes da Kira: executa o código dos nós "Code" dos workflows exportados
// (n8n/workflows/*.json) com dados simulados e confere a estrutura dos workflows.
// Uso: npm test   (ou: node scripts/testar-codigo.mjs)
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const raiz = new URL('../', import.meta.url);
const ler = (caminho) => readFileSync(new URL(caminho, raiz), 'utf8');
const workflow = JSON.parse(ler('n8n/workflows/kira-1.0.json'));
const nos = Object.fromEntries(workflow.nodes.map((n) => [n.name, n]));
const codigoDo = (nome) => {
  assert.ok(nos[nome], `nó não encontrado no workflow: ${nome}`);
  return nos[nome].parameters.jsCode;
};

// Simula o que o n8n oferece dentro do nó Code: $('Nó'), $input e DateTime (Luxon).
const DateTime = {
  now: () => ({
    setZone() { return this; },
    setLocale() { return this; },
    toFormat: () => '26/09/2026 às 21:00',
  }),
};
function executar(codigo, { nosAnteriores = {}, entrada = [] }) {
  const itens = (lista) => lista.map((json) => ({ json }));
  const $ = (nome) => {
    if (!(nome in nosAnteriores)) throw new Error(`nó não simulado: ${nome}`);
    const lista = itens([].concat(nosAnteriores[nome]));
    return { first: () => lista[0], all: () => lista };
  };
  const $input = { first: () => itens(entrada)[0], all: () => itens(entrada) };
  return new Function('$', '$input', 'DateTime', codigo)($, $input, DateTime).map((i) => i.json);
}

// Confere se o texto é HTML aceito pelo Telegram (tags permitidas, bem aninhadas, sem < > & soltos).
function htmlValidoParaTelegram(html) {
  const permitidas = new Set(['b', 'i', 's', 'u', 'code', 'pre', 'a']);
  const pilha = [];
  const re = /<(\/?)([a-z]+)(\s[^>]*)?>/g;
  let m;
  let ultimo = 0;
  while ((m = re.exec(html))) {
    if (/[<>]/.test(html.slice(ultimo, m.index))) return 'sinal < ou > solto';
    ultimo = re.lastIndex;
    const [, fecha, tag] = m;
    if (!permitidas.has(tag)) return `tag não suportada: ${tag}`;
    if (fecha) {
      if (pilha.pop() !== tag) return `tag fechada fora de ordem: ${tag}`;
    } else pilha.push(tag);
  }
  if (/[<>]/.test(html.slice(ultimo))) return 'sinal < ou > solto no fim';
  if (pilha.length) return `tags não fechadas: ${pilha.join(',')}`;
  if (/&(?!(amp|lt|gt|quot);)/.test(html.replace(/<[^>]+>/g, ''))) return '& sem escape';
  return true;
}

const config = {
  nome_dono: 'Bráulio',
  modo_voz: 'espelho',
  voz_tts: 'pt-BR-Chirp3-HD-Kore',
  max_caracteres_voz: 1500,
  fuso_horario: 'America/Sao_Paulo',
};
const ambientesDaKira = Object.fromEntries(
  (nos['Ambientes da Kira']?.parameters.assignments.assignments ?? []).map((c) => [c.name, c.value]),
);
const ambienteAtivo = { ambiente: 'TRABALHO', ambiente_nome: 'Trabalho', ambiente_descricao: 'Trabalho na empresa.', ambientes_texto: '' };
const entradaNormalizada = {
  chat_id: '111',
  user_id: '111',
  nome_usuario: 'Bráulio',
  texto: 'Kira, bom dia. Você está online?',
  comando: '',
  tipo_entrada: 'voz',
};

let falhas = 0;
const pendentes = [];
function teste(nome, fn) {
  const registrar = (erro) => {
    if (!erro) return console.log(`ok    ${nome}`);
    falhas += 1;
    console.log(`FALHA ${nome}\n      ${erro.message}`);
  };
  try {
    const resultado = fn();
    if (resultado && typeof resultado.then === 'function') {
      pendentes.push(resultado.then(() => registrar(), registrar));
      return;
    }
    registrar();
  } catch (erro) {
    registrar(erro);
  }
}

// ---------- Dividir mensagem: Markdown -> HTML do Telegram ----------
const partes = (texto) => executar(codigoDo('Dividir mensagem'), { nosAnteriores: { 'Resposta pronta': { texto } } });

for (const [nome, markdown, esperado] of [
  ['texto simples', 'Bom dia, Bráulio! Sim, estou online.', 'Bom dia, Bráulio! Sim, estou online.'],
  ['escapa HTML', '2 < 3 & 5 > 4', '2 &lt; 3 &amp; 5 &gt; 4'],
  ['negrito e itálico', '**Meta** e *foco* e __ok__ e _sim_', '<b>Meta</b> e <i>foco</i> e <b>ok</b> e <i>sim</i>'],
  ['código', 'Use `a < b` aqui', 'Use <code>a &lt; b</code> aqui'],
  ['bloco de código', '```js\nif (a < b) { x(); }\n```', '<pre>if (a &lt; b) { x(); }</pre>'],
  ['link', 'Veja [o site](https://ex.com/a_b?x=1&y=2)', 'Veja <a href="https://ex.com/a_b?x=1&amp;y=2">o site</a>'],
  ['listas', '- um\n* dois\n+ três', '• um\n• dois\n• três'],
  ['título', '## Resumo do **dia**\ntexto', '<b>Resumo do dia</b>\ntexto'],
  ['não confunde multiplicação', '2 * 3 * 4 = 24', '2 * 3 * 4 = 24'],
  ['não confunde snake_case', 'campo ids_autorizados_aqui', 'campo ids_autorizados_aqui'],
  ['tachado', '~~antigo~~ novo', '<s>antigo</s> novo'],
]) {
  teste(`formatação: ${nome}`, () => {
    const [parte] = partes(markdown);
    assert.equal(parte.html, esperado);
    assert.equal(htmlValidoParaTelegram(parte.html), true);
  });
}

teste('formatação: texto longo é dividido em partes que cabem no Telegram', () => {
  const paragrafo = 'Esta é uma frase de teste com alguns **negritos** e <sinais>. ';
  const longo = Array.from({ length: 12 }, () => paragrafo.repeat(12)).join('\n\n');
  const lista = partes(longo);
  assert.ok(lista.length >= 3, `esperava 3 ou mais partes, vieram ${lista.length}`);
  for (const parte of lista) {
    assert.ok(parte.texto_simples.length <= 4096);
    assert.equal(htmlValidoParaTelegram(parte.html), true);
  }
});

teste('formatação: o texto de reserva (sem formatação) é sempre HTML seguro', () => {
  const [parte] = partes('**a *b** c* <x> & y');
  assert.equal(htmlValidoParaTelegram(parte.texto_simples), true);
});

// ---------- Resposta pronta: voz ou texto ----------
const preparar = (envelope) =>
  executar(codigoDo('Resposta pronta'), {
    nosAnteriores: { 'Normalizar entrada': entradaNormalizada, 'Configuração da Kira': config },
    entrada: [envelope],
  })[0];

teste('resposta: responde por voz quando pedido e o texto é curto', () => {
  const r = preparar({ texto_resposta: 'Bom dia, Bráulio! ☀️ Sim, estou **online**.', modo_resposta: 'voz', status: 'ok' });
  assert.equal(r.modo_resposta, 'voz');
  assert.equal(r.texto_fala, 'Bom dia, Bráulio! Sim, estou online.');
  assert.equal(r.legenda, 'Bom dia, Bráulio! ☀️ Sim, estou online.');
  assert.equal(r.chat_id, '111');
  assert.equal(r.erro, '');
});

teste('resposta: mantém texto quando o modo é texto', () => {
  assert.equal(preparar({ texto_resposta: 'Oi!', modo_resposta: 'texto', status: 'ok' }).modo_resposta, 'texto');
});

teste('resposta: texto longo demais para voz vai por escrito (e fica registrado)', () => {
  const r = preparar({ texto_resposta: 'palavra '.repeat(400), modo_resposta: 'voz', status: 'ok' });
  assert.equal(r.modo_resposta, 'texto');
  assert.match(r.erro, /longa demais/);
});

teste('resposta: a fala não lê links, marcadores de lista nem emojis', () => {
  const r = preparar({ texto_resposta: 'Veja:\n- item 1 ✅\n- item 2 (https://ex.com)\n[site](https://ex.com)', modo_resposta: 'voz' });
  assert.equal(r.texto_fala, 'Veja:\nitem 1\nitem 2\nsite');
});

teste('resposta: resposta vazia vira um aviso educado', () => {
  assert.match(preparar({ texto_resposta: '  ', modo_resposta: 'texto' }).texto, /Desculpe/);
});

teste('resposta: legenda do áudio fica abaixo do limite e escapada', () => {
  const r = preparar({ texto_resposta: '<b>' + 'x'.repeat(2000), modo_resposta: 'voz' });
  assert.ok(r.legenda.length < 1024);
  assert.ok(r.legenda.startsWith('&lt;b&gt;'));
});

// ---------- Resposta do comando ----------
const comando = (cmd, memorias = [{}]) =>
  executar(codigoDo('Resposta do comando'), {
    nosAnteriores: {
      'Normalizar entrada': { ...entradaNormalizada, tipo_entrada: 'comando', comando: cmd, texto: cmd },
      'Configuração da Kira': config,
      'Ambientes da Kira': ambientesDaKira,
      'Ambiente atual': ambienteAtivo,
    },
    entrada: memorias,
  })[0];

for (const cmd of ['/start', '/ajuda', '/help', '/status', '/memorias', '/limpar', '/reset', '/id', '/xyz']) {
  teste(`comando ${cmd}`, () => {
    const r = comando(cmd);
    assert.equal(r.modo_resposta, 'texto');
    assert.equal(r.status, 'comando');
    assert.ok(r.texto_resposta.length > 10);
    assert.equal(htmlValidoParaTelegram(partes(r.texto_resposta)[0].html), true);
  });
}

teste('comando /status conta as memórias (ignora o item vazio de "nenhum resultado")', () => {
  assert.match(comando('/status', [{}]).texto_resposta, /Memórias guardadas: 0/);
  assert.match(comando('/status', [{ id: 1, fato: 'a' }, { id: 2, fato: 'b' }]).texto_resposta, /Memórias guardadas: 2/);
});

teste('comando /memorias lista só as do ambiente ativo e as gerais', () => {
  const r = comando('/memorias', [
    { id: 7, contexto: 'TRABALHO', categoria: 'preferencia', fato: 'Prefere respostas curtas' },
    { id: 8, contexto: 'PESSOAL', categoria: 'meta', fato: 'Correr 5 km' },
    { id: 9, categoria: 'geral', fato: 'Mora em Belo Horizonte' },
  ]);
  const html = partes(r.texto_resposta)[0].html;
  assert.match(html, /• \[7\] \(TRABALHO · preferencia\) Prefere respostas curtas/);
  assert.match(html, /• \[9\] \(GERAL\) Mora em Belo Horizonte/);
  assert.doesNotMatch(html, /Correr 5 km/);
  assert.match(html, /ambiente Trabalho e gerais \(2\)/);
});

teste('comando /id mostra os ids como código', () => {
  assert.match(partes(comando('/id').texto_resposta)[0].html, /<code>111<\/code>/);
});

// ---------- /publicar: LinkedIn, com ou sem imagem ----------
// Simula os nós do ramo /publicar: quais rodaram, o que devolveram e o erro de cada um.
function publicar(texto, rodaram = {}) {
  const fixos = {
    'Normalizar entrada': { ...entradaNormalizada, tipo_entrada: 'comando', comando: '/publicar', texto },
    'Configuração da Kira': config,
    'Ambientes da Kira': ambientesDaKira,
    'Ambiente atual': ambienteAtivo,
  };
  const $ = (nome) => {
    if (nome in fixos) return { isExecuted: true, first: () => ({ json: fixos[nome] }), all: () => [{ json: fixos[nome] }] };
    if (!(nome in rodaram)) {
      const erro = () => {
        throw new Error(`nó não executado: ${nome}`);
      };
      return { isExecuted: false, first: erro, all: erro };
    }
    const { saida = [{}], erro = [] } = rodaram[nome];
    return {
      isExecuted: true,
      first: () => ({ json: saida[0] ?? {} }),
      all: (saidaDoNo = 0) => (saidaDoNo === 1 ? erro : saida).map((json) => ({ json })),
    };
  };
  const $input = { first: () => undefined, all: () => [] };
  return new Function('$', '$input', 'DateTime', codigoDo('Resposta do comando'))($, $input, DateTime)[0].json.texto_resposta;
}
const rascunho = (imagem_id) => ({ 'Buscar rascunho (LinkedIn)': { saida: [{ id: 3, texto: 'Post', status: 'pendente', imagem_id }] } });

teste('/publicar: post só com texto', () => {
  const r = publicar('/publicar 3', { ...rascunho(0), 'Publicar no LinkedIn': { saida: [{ urn: 'urn:li:share:1' }] }, 'Marcar como publicado': {} });
  assert.equal(r, '✅ Publiquei no LinkedIn o rascunho 3.');
});
teste('/publicar: post com imagem', () => {
  const r = publicar('/publicar 3', { ...rascunho(5), 'Publicar no LinkedIn (com imagem)': { saida: [{ urn: 'urn:li:share:1' }] }, 'Marcar como publicado': {} });
  assert.equal(r, '✅ Publiquei no LinkedIn o rascunho 3 com a imagem #5.');
});
teste('/publicar: imagem que não baixou não publica nada', () => {
  const r = publicar('/publicar 3', { ...rascunho(5), 'Buscar imagem (LinkedIn)': {}, 'Baixar imagem (LinkedIn)': { saida: [], erro: [{ error: 'file not found' }] } });
  assert.match(r, /Não consegui pegar a imagem #5 do rascunho 3\. Erro: file not found Nada foi publicado/);
});
teste('/publicar: erro do LinkedIn aparece e o rascunho continua guardado', () => {
  const r = publicar('/publicar 3', { ...rascunho(5), 'Baixar imagem (LinkedIn)': {}, 'Publicar no LinkedIn (com imagem)': { saida: [], erro: [{ error: { message: 'Forbidden' } }] } });
  assert.equal(r, '😕 Não consegui publicar o rascunho 3 no LinkedIn. Erro: Forbidden O rascunho continua guardado.');
});
teste('/publicar: sem número ou rascunho inexistente', () => {
  assert.match(publicar('/publicar'), /Me diga qual rascunho publicar/);
  assert.match(publicar('/publicar 9', { 'Buscar rascunho (LinkedIn)': { saida: [{}] } }), /Não encontrei o rascunho 9 pendente/);
});
teste('comando /status e /ajuda mostram as imagens e o ambiente', () => {
  assert.match(comando('/status').texto_resposta, /Imagens: gero com o Gemini/);
  assert.match(comando('/status').texto_resposta, /Ambiente: Trabalho/);
  assert.match(comando('/ajuda').texto_resposta, /modo <ambiente> — troca de ambiente \(Trabalho, Negócios, Pessoal\)/);
  assert.match(comando('/ajuda').texto_resposta, /\/publicar N — publica no LinkedIn o rascunho N que eu preparei \(com a imagem, se tiver\)/);
});

// ---------- Estrutura e segurança do workflow ----------
teste('workflow: todas as conexões apontam para nós que existem', () => {
  for (const [origem, tipos] of Object.entries(workflow.connections)) {
    assert.ok(nos[origem], `origem inexistente: ${origem}`);
    for (const saidas of Object.values(tipos)) {
      for (const conexao of saidas.flat()) assert.ok(nos[conexao.node], `destino inexistente: ${conexao.node}`);
    }
  }
});

teste('workflow: começa em modo de configuração (sem IDs autorizados gravados)', () => {
  const campos = nos['Configuração da Kira'].parameters.assignments.assignments;
  assert.equal(campos.find((c) => c.name === 'ids_autorizados').value, '');
});

teste('workflow: as duas memórias da conversa usam a mesma Session Key (/limpar depende disso)', () => {
  assert.equal(
    nos['Memória da conversa'].parameters.sessionKey,
    nos['Memória da conversa (para limpar)'].parameters.sessionKey,
  );
});

teste('workflow: nenhuma mensagem do Telegram leva a assinatura automática do n8n', () => {
  for (const no of workflow.nodes.filter((n) => n.parameters?.operation === 'sendMessage')) {
    assert.equal(no.parameters.additionalFields?.appendAttribution, false, no.name);
  }
});

// ---------- Voz: Preparar áudio (WAV) ----------
teste('voz: áudio PCM do Gemini ganha cabeçalho WAV e duração correta', () => {
  const pcm = Buffer.alloc(48000 * 3); // 3 s de silêncio, 24 kHz, 16 bits, mono
  const [r] = executar(codigoDo('Preparar áudio (WAV)'), {
    entrada: [{ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: pcm.toString('base64') } }] } }] }],
  });
  const wav = Buffer.from(r.audioContent, 'base64');
  assert.equal(wav.subarray(0, 4).toString(), 'RIFF');
  assert.equal(wav.readUInt32LE(24), 24000);
  assert.equal(wav.length, pcm.length + 44);
  assert.equal(r.segundos, 3);
});
teste('voz: WAV pronto do Gemini passa sem mudança', () => {
  const pcm = Buffer.alloc(48000 * 2);
  const [pronto] = executar(codigoDo('Preparar áudio (WAV)'), {
    entrada: [{ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;rate=24000', data: pcm.toString('base64') } }] } }] }],
  });
  const [r] = executar(codigoDo('Preparar áudio (WAV)'), {
    entrada: [{ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/wav', data: pronto.audioContent } }] } }] }],
  });
  assert.equal(r.audioContent, pronto.audioContent);
  assert.equal(r.segundos, 2);
});
teste('voz: resposta sem áudio vira erro (e a Kira responde por texto)', () => {
  assert.throws(() => executar(codigoDo('Preparar áudio (WAV)'), { entrada: [{ candidates: [] }] }), /não devolveu áudio/);
});

// ---------- Outlook: somente leitura ----------
teste('outlook: as ferramentas só fazem leitura (GET)', () => {
  const ferramentas = ['emails_recentes', 'buscar_emails', 'ler_email', 'agenda'];
  for (const nome of ferramentas) {
    assert.ok(nos[nome], `ferramenta ausente: ${nome}`);
    assert.equal(nos[nome].parameters.method, 'GET', nome);
    assert.match(String(nos[nome].parameters.url), /graph\.microsoft\.com\/v1\.0\/me\//, nome);
  }
});

// ---------- Google Drive e rascunhos de resposta ----------
teste('drive: as ferramentas só fazem leitura (GET)', () => {
  for (const nome of ['buscar_arquivos_drive', 'ler_arquivo_drive']) {
    assert.ok(nos[nome], `ferramenta ausente: ${nome}`);
    assert.equal(nos[nome].parameters.method ?? 'GET', 'GET', nome);
    assert.match(String(nos[nome].parameters.url), /googleapis\.com\/drive\/v3\/files/, nome);
  }
});
teste('outlook: rascunho de resposta só cria rascunho (createReply), nunca envia', () => {
  const p = nos.criar_rascunho_resposta.parameters;
  assert.equal(p.method, 'POST');
  assert.match(p.url, /\/createReply' \}\}$/);
  assert.doesNotMatch(JSON.stringify(workflow), /\/send'|sendMail|\/reply'/);
  // o texto vira HTML seguro: escapa & < > e troca quebras de linha por <br>
  assert.match(p.jsonBody, /replace\(\/&\/g, '&amp;'\)\.replace\(\/<\/g, '&lt;'\)\.replace\(\/>\/g, '&gt;'\)\.replace\(\/\\n\/g, '<br>'\)/);
});

// ---------- Imagens: ferramentas e sub-workflows ----------
teste('imagens: gerar_imagem e anexar_imagem_email são ferramentas da Kira', () => {
  for (const nome of ['gerar_imagem', 'anexar_imagem_email']) {
    assert.equal(nos[nome]?.type, '@n8n/n8n-nodes-langchain.toolWorkflow', nome);
    assert.deepEqual(workflow.connections[nome].ai_tool[0][0].node, 'Kira', nome);
    // o id do sub-workflow é de cada instalação: no repositório ele fica vazio
    assert.equal(nos[nome].parameters.workflowId.value, '', nome);
  }
  const entradas = nos.gerar_imagem.parameters.workflowInputs.value;
  assert.match(entradas.chat_id, /Normalizar entrada/, 'o chat vem do Telegram, não da IA');
  assert.match(entradas.user_id, /Normalizar entrada/, 'o usuário vem do Telegram, não da IA');
});
teste('imagens: rascunho do LinkedIn guarda o número da imagem', () => {
  assert.match(nos.rascunho_linkedin.parameters.columns.value.imagem_id, /\$fromAI\('imagem_id'/);
});
teste('imagens: /publicar usa o post com imagem só quando o rascunho tem imagem', () => {
  const ramo = workflow.connections['Rascunho tem imagem?'].main;
  assert.equal(ramo[0][0].node, 'Buscar imagem (LinkedIn)');
  assert.equal(ramo[1][0].node, 'Publicar no LinkedIn');
  const comImagem = nos['Publicar no LinkedIn (com imagem)'].parameters;
  assert.equal(comImagem.shareMediaCategory, 'IMAGE');
  assert.equal(comImagem.binaryPropertyName, 'data');
  for (const nome of ['Publicar no LinkedIn', 'Publicar no LinkedIn (com imagem)']) {
    assert.equal(nos[nome].parameters.person, '', `${nome}: o id da pessoa no LinkedIn fica só no n8n`);
  }
});

const gerarImagem = JSON.parse(ler('n8n/workflows/kira-gerar-imagem.json'));
const anexarImagem = JSON.parse(ler('n8n/workflows/kira-anexar-imagem.json'));
const noDe = (w, nome) => {
  const no = w.nodes.find((n) => n.name === nome);
  assert.ok(no, `nó não encontrado: ${nome}`);
  return no;
};

teste('imagens: pedido ao Gemini com formato e modelos principal e reserva', () => {
  const [p] = executar(noDe(gerarImagem, 'Preparar pedido').parameters.jsCode, {
    entrada: [{ descricao: '  Um farol  ', legenda: 'Farol', formato: 'Paisagem', chat_id: 111, user_id: 111 }],
  });
  assert.equal(p.descricao, 'Um farol');
  assert.equal(p.formato, '16:9');
  assert.equal(p.chat_id, '111');
  assert.notEqual(p.modelo, p.modelo_reserva);
  const corpo = JSON.parse(p.corpo);
  assert.deepEqual(corpo.generationConfig.imageConfig, { aspectRatio: '16:9' });
  assert.equal(corpo.contents[0].parts[0].text, 'Um farol');
  assert.equal(executar(noDe(gerarImagem, 'Preparar pedido').parameters.jsCode, { entrada: [{ descricao: 'x', formato: 'qualquer' }] })[0].formato, '1:1');
  assert.throws(() => executar(noDe(gerarImagem, 'Preparar pedido').parameters.jsCode, { entrada: [{ descricao: ' ' }] }), /descrição/);
});
teste('imagens: pega a imagem final do Gemini (ignora rascunhos do modelo)', () => {
  const [e] = executar(noDe(gerarImagem, 'Extrair imagem').parameters.jsCode, {
    nosAnteriores: { 'Registrar imagem': { id: 7 } },
    entrada: [{ candidates: [{ content: { parts: [{ text: 'Aqui está' }, { inlineData: { mimeType: 'image/png', data: 'AAA' }, thought: true }, { inlineData: { mimeType: 'image/jpeg', data: 'BBB' } }] } }] }],
  });
  assert.deepEqual(e, { imagem_base64: 'BBB', mime: 'image/jpeg', nome_arquivo: 'kira-imagem-7.jpg' });
});
teste('imagens: pedido recusado vira erro com o motivo', () => {
  assert.throws(
    () =>
      executar(noDe(gerarImagem, 'Extrair imagem').parameters.jsCode, {
        nosAnteriores: { 'Registrar imagem': { id: 7 } },
        entrada: [{ candidates: [{ finishReason: 'IMAGE_SAFETY', content: { parts: [{ text: 'Não posso gerar isso.' }] } }] }],
      }),
    /não devolveu imagem \(IMAGE_SAFETY\): Não posso gerar isso\./,
  );
});
teste('imagens: falta de cota do Google é explicada para a Kira', () => {
  const [r] = executar(noDe(gerarImagem, 'Explicar falha').parameters.jsCode, {
    entrada: [{ error: { message: 'Too many requests', error: { error: { code: 429, message: 'You exceeded your current quota', status: 'RESOURCE_EXHAUSTED' } } } }],
  });
  assert.equal(r.ok, false);
  assert.equal(r.sem_cota, true);
  assert.match(r.erro, /exceeded your current quota/);
});
teste('imagens: a imagem vai para o Telegram e a referência fica em kira_imagens', () => {
  assert.equal(noDe(gerarImagem, 'Enviar imagem').parameters.operation, 'sendPhoto');
  assert.equal(noDe(gerarImagem, 'Registrar imagem').parameters.dataTableId.value, 'kira_imagens');
  assert.match(noDe(gerarImagem, 'Guardar arquivo').parameters.columns.value.file_id, /result\.photo/);
});
teste('imagens: o anexo só entra em rascunho do Outlook (nunca envia)', () => {
  const anexar = noDe(anexarImagem, 'Anexar ao rascunho').parameters;
  assert.equal(anexar.method, 'POST');
  assert.match(anexar.url, /graph\.microsoft\.com\/v1\.0\/me\/messages\/' \+ encodeURIComponent\(.*\) \+ '\/attachments'/);
  assert.doesNotMatch(JSON.stringify(anexarImagem), /\/send\b|sendMail/);
  const busca = noDe(anexarImagem, 'Buscar imagem').parameters.filters.conditions.map((c) => c.keyName);
  assert.deepEqual(busca, ['id', 'user_id'], 'só imagens do próprio usuário');
  const [r] = executar(noDe(anexarImagem, 'Explicar falha').parameters.jsCode, { entrada: [{ error: { message: 'ErrorItemNotFound' } }] });
  assert.equal(r.ok, false);
  assert.equal(r.erro, 'ErrorItemNotFound');
});

// ---------- Resumo da manhã ----------
const resumo = JSON.parse(ler('n8n/workflows/kira-resumo-da-manha.json'));
const nosResumo = Object.fromEntries(resumo.nodes.map((n) => [n.name, n]));
teste('resumo: roda às 7h no horário de Brasília', () => {
  const regra = nosResumo['Todo dia às 7h'].parameters.rule.interval[0];
  assert.equal(regra.triggerAtHour, 7);
  assert.equal(resumo.settings.timezone, 'America/Sao_Paulo');
});
teste('resumo: todas as seções têm fontes e o Gemini não inventa (só usa a lista)', () => {
  const fontes = executar(nosResumo.Fontes.parameters.jsCode, {});
  for (const secao of ['Brasil', 'Mundo', 'Mercado financeiro', 'Mineração, petróleo, siderurgia e florestal', 'Política', 'Tecnologia e tendências']) {
    assert.ok(fontes.filter((f) => f.secao === secao).length >= 2, secao);
  }
  assert.match(nosResumo['Resumir (Gemini)'].parameters.options.systemMessage, /SOMENTE as notícias/);
});
teste('resumo: reserva sem IA monta títulos com link', () => {
  const selecao = { noticias: [{ secao: 'Mundo', fonte: 'BBC', titulo: 'Fato', link: 'https://x/1' }] };
  const [r] = executar(nosResumo['Resumo reserva (só títulos)'].parameters.jsCode, {
    nosAnteriores: { 'Selecionar notícias': selecao, 'Configuração do resumo': { nome_dono: 'Bráulio' } },
  });
  const [m] = executar(nosResumo['Montar mensagem'].parameters.jsCode, { entrada: [r] });
  assert.match(m.html, /• Fato \(<a href="https:\/\/x\/1">BBC<\/a>\)/);
  assert.equal(htmlValidoParaTelegram(m.html), true);
});
teste('resumo: setores só com veículos confiáveis do Google Notícias', () => {
  const agora = new Date().toISOString();
  const busca = { secao: 'Mineração, petróleo, siderurgia e florestal', fonte: 'Google Notícias: petróleo', limite: 4 };
  const itens = [
    { title: 'Petrobras anuncia novo poço - Valor Econômico', link: 'https://news.google.com/rss/articles/1', isoDate: agora },
    { title: 'Time vence o Siderúrgica - Jornal Local', link: 'https://news.google.com/rss/articles/2', isoDate: agora },
    { title: 'Sem veículo no título', link: 'https://news.google.com/rss/articles/3', isoDate: agora },
  ];
  const $ = (nome) => {
    if (nome === 'Configuração do resumo') return { first: () => ({ json: { itens_por_fonte: 6, horas: 24 } }) };
    if (nome === 'Fontes') return { itemMatching: () => ({ json: busca }) };
    throw new Error(nome);
  };
  const [sel] = new Function('$', '$input', nosResumo['Selecionar notícias'].parameters.jsCode)($, { all: () => itens.map((json) => ({ json })) }).map((i) => i.json);
  assert.equal(sel.total, 1);
  assert.equal(sel.noticias[0].fonte, 'Valor Econômico');
  assert.equal(sel.noticias[0].titulo, 'Petrobras anuncia novo poço');
});
teste('resumo: cotações do Banco Central e da Coinbase, cada uma independente', async () => {
  const codigo = nosResumo['Cotações do dia'].parameters.jsCode;
  const rodar = async (respostas) => {
    const helpers = { httpRequest: async ({ url }) => { const r = respostas(url); if (r instanceof Error) throw r; return r; } };
    const tempo = { now: () => ({ setZone() { return this; }, minus() { return this; }, toFormat: () => '2026-09-26' }) };
    const fn = new Function('DateTime', `return (async function () { ${codigo} });`)(tempo);
    return (await fn.call({ helpers }))[0].json;
  };
  const ok = (url) =>
    url.includes('sgs.1/') ? [{ valor: '5.00' }, { valor: '5.10' }]
    : url.includes('sgs.21619/') ? [{ valor: '6.00' }, { valor: '5.94' }]
    : url.includes('date=') ? { data: { amount: '400000' } }
    : { data: { amount: '404000' } };
  const r = await rodar(ok);
  assert.ok(Math.abs(r.USDBRL.pctChange - 2) < 1e-9);
  assert.equal(r.BTCBRL.bid, 404000);
  const parcial = await rodar((url) => (url.includes('bcb') ? new Error('403') : ok(url)));
  assert.equal(parcial.USDBRL, undefined);
  assert.equal(parcial.BTCBRL.bid, 404000);
  assert.deepEqual(parcial.falhas, ['USDBRL: 403', 'EURBRL: 403']);
});
teste('resumo: depois do texto vem o áudio da Kira (roteiro + voz do Gemini)', () => {
  const proximo = (nome) => resumo.connections[nome].main[0][0].node;
  assert.equal(proximo('Enviar resumo'), 'Texto para a voz');
  assert.equal(proximo('Texto para a voz'), 'Roteiro da voz (Gemini)');
  assert.equal(proximo('Roteiro da voz (Gemini)'), 'Voz do resumo (Gemini)');
  assert.equal(proximo('Voz do resumo (Gemini)'), 'Preparar áudio (WAV)');
  assert.equal(proximo('Preparar áudio (WAV)'), 'Áudio para arquivo');
  assert.equal(proximo('Áudio para arquivo'), 'Enviar áudio do resumo');
  assert.equal(nosResumo['Enviar áudio do resumo'].parameters.operation, 'sendAudio');
  const anteriores = {
    'Resumir (Gemini)': { mergedResponse: '- Fato ([g1](https://g1.globo.com/a)) e https://x.com/b' },
    'Configuração do resumo': { nome_dono: 'Bráulio' },
  };
  const $ = (nome) => ({ isExecuted: nome in anteriores, first: () => ({ json: anteriores[nome] }) });
  const [voz] = new Function('$', nosResumo['Texto para a voz'].parameters.jsCode)($).map((i) => i.json);
  assert.equal(voz.resumo, '- Fato (g1) e');
  assert.equal(voz.nome, 'Bráulio');
});

teste('resumo: repositório sem chat_id preenchido', () => {
  const chat = nosResumo['Configuração do resumo'].parameters.assignments.assignments.find((a) => a.name === 'chat_id');
  assert.equal(chat.value, '');
});

// ---------- Teams ----------
const teams = JSON.parse(ler('n8n/workflows/kira-teams.json'));
const tempoTeams = { fromISO: (iso) => ({ setZone: () => ({ toFormat: () => `(${iso})` }) }) };
const rodarTeams = (nome, entradaTrigger, entrada) =>
  new Function('$', '$input', 'DateTime', noDe(teams, nome).parameters.jsCode)(
    () => ({ first: () => ({ json: entradaTrigger }) }),
    { first: () => ({ json: entrada }) },
    tempoTeams,
  ).map((i) => i.json);
teste('teams: ferramentas da Kira (listar, ler e enviar) no sub-workflow', () => {
  for (const [nome, acao] of [['conversas_teams', 'listar'], ['ler_conversa_teams', 'ler'], ['enviar_mensagem_teams', 'enviar']]) {
    assert.equal(nos[nome]?.type, '@n8n/n8n-nodes-langchain.toolWorkflow', nome);
    assert.equal(nos[nome].parameters.workflowInputs.value.acao, acao, nome);
    assert.equal(workflow.connections[nome].ai_tool[0][0].node, 'Kira', nome);
    assert.equal(nos[nome].parameters.workflowId.value, '', nome);
  }
  assert.match(nos.Kira.parameters.options.systemMessage, /Envie só quando ele pedir/);
});
teste('teams: conversas resumidas, com o dono fora da lista e busca por nome', () => {
  const dono = { userId: 'eu', displayName: 'Dono' };
  const [r] = rodarTeams('Resumir conversas', { busca: 'joao', quantidade: 5 }, {
    value: [
      { id: 'c1', chatType: 'oneOnOne', members: [dono, { userId: 'u1', displayName: 'João Silva' }], lastMessagePreview: { createdDateTime: '2026-09-27T12:00:00Z', from: { user: { displayName: 'João Silva' } }, body: { content: '<p>Oi &amp; tudo bem?</p>' } } },
      { id: 'c2', chatType: 'group', topic: 'Compras', members: [dono, { userId: 'u2', displayName: 'Maria' }] },
    ],
  });
  assert.equal(r.total, 1);
  assert.deepEqual(r.conversas[0].pessoas, ['João Silva']);
  assert.equal(r.conversas[0].ultima_mensagem.texto, 'Oi & tudo bem?');
});
teste('teams: mensagens em ordem e envio só em conversa existente (HTML seguro)', () => {
  const [m] = rodarTeams('Resumir mensagens', { chat_id: 'c1' }, {
    value: [
      { messageType: 'message', createdDateTime: 'B', from: { user: { displayName: 'João' } }, body: { content: '<div>Segunda</div>' } },
      { messageType: 'systemEventMessage', body: { content: '' } },
      { messageType: 'message', createdDateTime: 'A', from: { user: { displayName: 'Dono' } }, body: { content: 'Primeira' } },
    ],
  });
  assert.deepEqual(m.mensagens.map((x) => x.texto), ['Primeira', 'Segunda']);
  const [e] = rodarTeams('Preparar envio', { chat_id: 'c1', texto: 'Oi\n<pedido> & prazo' }, {});
  assert.deepEqual(JSON.parse(e.corpo), { body: { contentType: 'html', content: 'Oi<br>&lt;pedido&gt; &amp; prazo' } });
  assert.throws(() => rodarTeams('Preparar envio', { chat_id: '', texto: 'x' }, {}), /id da conversa/);
  const enviar = noDe(teams, 'Enviar mensagem').parameters;
  assert.equal(enviar.method, 'POST');
  assert.match(enviar.url, /graph\.microsoft\.com\/v1\.0\/chats\/' \+ encodeURIComponent\(\$json\.chat_id\) \+ '\/messages'/);
});

// ---------- Pedidos (planilha do ERP) ----------
const pedidos = JSON.parse(ler('n8n/workflows/kira-pedidos.json'));
teste('pedidos: busca por número e por nome, filtros e resumo, sem inventar campos', () => {
  const linhas = [
    { CD_PEDIDO: 1001, SEQUENCIA: 1, CLIENTE_FANTASIA: 'Mineradora Alfa', CD_MATERIAL: 555, DESC_MATERIAL: 'Bomba hidráulica', SITUACAO_PEDIDO: 'Aberto', ATRASO: 5, CD_ORDEM: 9001, NOME_FORNECEDOR_OC: 'Fornecedor X' },
    { CD_PEDIDO: 1001, SEQUENCIA: 2, CLIENTE_FANTASIA: 'Mineradora Alfa', DESC_MATERIAL: 'Válvula', SITUACAO_PEDIDO: 'Aberto', ATRASO: 0, CD_SOLICITACAO: 7001 },
    { CD_PEDIDO: 2002, SEQUENCIA: 1, CLIENTE_FANTASIA: 'Siderúrgica Beta', CD_MATERIAL: 1001, DESC_MATERIAL: 'Cilindro', SITUACAO_PEDIDO: 'Faturado', NF: 12345, OP: 3003 },
  ];
  const tempo = { fromMillis: () => ({ toFormat: () => '' }), fromISO: () => ({ setZone: () => ({ toFormat: () => '27/09/2026 às 10:44' }) }) };
  const consultar = (entrada) =>
    new Function('$', '$input', 'DateTime', noDe(pedidos, 'Consultar planilha').parameters.jsCode)(
      (nome) => ({ first: () => ({ json: nome === 'Informações do arquivo' ? { name: 'pedidos.xlsx', lastModifiedDateTime: 'x' } : entrada }) }),
      { all: () => linhas.map((json) => ({ json })) },
      tempo,
    )[0].json;
  assert.equal(consultar({ busca: '1001' }).resumo.itens, 3, 'pedido 1001 e material 1001');
  const beta = consultar({ busca: 'siderurgica' });
  assert.deepEqual([beta.itens[0].nf, beta.itens[0].op], ['12345', '3003']);
  assert.equal(beta.itens[0].compra, undefined, 'campos vazios não aparecem');
  assert.equal(consultar({ tipo: 'atrasados' }).resumo.itens, 1);
  assert.equal(consultar({ tipo: 'solicitacao' }).itens[0].solicitacao.numero, '7001');
  assert.equal(consultar({ tipo: 'resumo' }).itens.length, 0);
  assert.match(consultar({ busca: 'nada' }).orientacao, /Nada encontrado/);
  assert.match(consultar({ busca: '1001' }).fonte, /pedidos\.xlsx do ERP, atualizada em 27\/09\/2026/);
});
teste('pedidos: repositório sem os ids do arquivo; a Kira tem a ferramenta', () => {
  assert.match(noDe(pedidos, 'Baixar planilha').parameters.url, /drives\/ID_DO_DRIVE\/items\/ID_DO_ARQUIVO\/content$/);
  assert.equal(workflow.connections.consultar_pedidos.ai_tool[0][0].node, 'Kira');
  assert.equal(nos.consultar_pedidos.parameters.workflowId.value, '');
});

// ---------- Kira 2.0: ambientes ----------
const ambienteDe = (salvo, amb = ambientesDaKira) =>
  executar(codigoDo('Ambiente atual'), { nosAnteriores: { 'Ambientes da Kira': amb }, entrada: [salvo] })[0];

teste('ambientes: o repositório vem com Trabalho, Negócios e Pessoal (padrão: Trabalho)', () => {
  const lista = JSON.parse(ambientesDaKira.ambientes);
  assert.deepEqual(lista.map((a) => a.codigo), ['TRABALHO', 'NEGOCIOS', 'PESSOAL']);
  assert.equal(ambientesDaKira.ambiente_padrao, 'TRABALHO');
});
teste('ambientes: sem nada salvo usa o padrão; o salvo vale em qualquer caixa', () => {
  const r = ambienteDe({});
  assert.equal(r.ambiente, 'TRABALHO');
  assert.match(r.ambientes_texto, /- NEGOCIOS \(Negócios\): Negócios próprios/);
  assert.equal(ambienteDe({ contexto: 'pessoal' }).ambiente, 'PESSOAL');
  assert.equal(ambienteDe({ contexto: 'MARTE' }).ambiente, 'TRABALHO');
});
teste('ambientes: configuração inválida vira um ambiente único (GERAL)', () => {
  assert.equal(ambienteDe({ contexto: 'NEGOCIOS' }, { ...ambientesDaKira, ambientes: '{quebrado' }).ambiente, 'GERAL');
});

const trocaDe = (pergunta) =>
  executar(codigoDo('Detectar troca de ambiente'), { nosAnteriores: { 'Ambientes da Kira': ambientesDaKira, Pergunta: { pergunta } } })[0].troca;
for (const [frase, esperado] of [
  ['Kira, modo negócios.', 'NEGOCIOS'],
  ['modo Trabalho', 'TRABALHO'],
  ['/pessoal', 'PESSOAL'],
  ['/modo negocios', 'NEGOCIOS'],
  ['Kira, mude para o ambiente pessoal.', 'PESSOAL'],
  ['vamos para o modo empresa', 'TRABALHO'],
  ['troca pra vendas', 'NEGOCIOS'],
  ['Ok Kira, ativar modo escritório!', 'TRABALHO'],
  ['ambiente pessoal', 'PESSOAL'],
]) {
  teste(`ambientes: "${frase}" troca para ${esperado}`, () => assert.equal(trocaDe(frase), esperado));
}
teste('ambientes: conversa normal não troca de ambiente', () => {
  for (const frase of ['Kira, como está minha meta pessoal?', 'modo avião', '/modo', 'Kira, preciso responder aquele e-mail do trabalho sobre o pedido 123 ainda hoje']) {
    assert.equal(trocaDe(frase), '', frase);
  }
});

teste('ambientes: a Kira só vê as memórias do ambiente ativo e as gerais', () => {
  const [r] = executar(codigoDo('Memórias do ambiente'), {
    nosAnteriores: { 'Ambientes da Kira': ambientesDaKira, 'Ambiente atual': { ambiente: 'NEGOCIOS' } },
    entrada: [
      { id: 1, contexto: 'NEGOCIOS', categoria: 'cliente', fato: 'Cliente A' },
      { id: 2, contexto: 'TRABALHO', categoria: 'projeto', fato: 'Projeto sigiloso' },
      { id: 3, categoria: 'negocios', fato: 'Antiga de negócios' },
      { id: 4, categoria: 'pessoal', fato: 'Antiga pessoal' },
      { id: 5, contexto: 'GERAL', categoria: 'preferencia', fato: 'Respostas curtas' },
      {},
    ],
  });
  assert.equal(r.total, 3);
  assert.equal(r.memorias, '[1] (NEGOCIOS · cliente) Cliente A\n[3] (NEGOCIOS) Antiga de negócios\n[5] (GERAL · preferencia) Respostas curtas');
});

teste('ambientes: o ambiente é descoberto antes de separar a mensagem e a troca responde na hora', () => {
  const destino = (origem, saida = 0) => (workflow.connections[origem]?.main?.[saida] ?? []).map((c) => c.node);
  assert.deepEqual(destino('Mostrar "digitando…"'), ['Ambientes da Kira']);
  assert.deepEqual(destino('Ambientes da Kira'), ['Buscar ambiente']);
  assert.deepEqual(destino('Buscar ambiente'), ['Ambiente atual']);
  assert.deepEqual(destino('Ambiente atual'), ['Tipo de mensagem']);
  assert.deepEqual(destino('Pergunta'), ['Detectar troca de ambiente']);
  assert.deepEqual(destino('Trocar ambiente?', 0), ['Salvar ambiente']);
  assert.deepEqual(destino('Trocar ambiente?', 1), ['Buscar memórias']);
  assert.deepEqual(destino('Resposta: ambiente ativado'), ['Resposta pronta']);
});

teste('ambientes: histórico, tarefas, contatos e conversas separados por usuário e ambiente', () => {
  assert.match(nos['Memória da conversa'].parameters.sessionKey, /\$\('Ambiente atual'\)\.first\(\)\.json\.ambiente/);
  const doUsuario = /\$\('Normalizar entrada'\)\.first\(\)\.json\.user_id/;
  const doAmbiente = /\$\('Ambiente atual'\)\.first\(\)\.json\.ambiente/;
  for (const nome of ['buscar_conversas', 'listar_tarefas', 'concluir_tarefa', 'buscar_contatos']) {
    const filtros = nos[nome].parameters.filters.conditions;
    assert.match(filtros.find((f) => f.keyName === 'user_id').keyValue, doUsuario, nome);
    assert.match(filtros.find((f) => f.keyName === 'contexto').keyValue, doAmbiente, nome);
    assert.equal(workflow.connections[nome].ai_tool[0][0].node, 'Kira', nome);
  }
  for (const nome of ['criar_tarefa', 'salvar_contato']) {
    const valores = nos[nome].parameters.columns.value;
    assert.match(valores.user_id, doUsuario, nome);
    assert.match(valores.contexto, doAmbiente, nome);
  }
  assert.ok('contexto' in nos['Registrar conversa'].parameters.columns.value);
});

// ---------- Rascunhos automáticos (Outlook) ----------
const rascunhosAuto = JSON.parse(ler('n8n/workflows/kira-rascunhos-automaticos.json'));
const noRA = (nome) => {
  const n = rascunhosAuto.nodes.find((x) => x.name === nome);
  assert.ok(n, `nó não encontrado nos rascunhos automáticos: ${nome}`);
  return n;
};
// Executa um nó Code com $json e $('Nó').item (modo "uma vez por item") ou first/all.
function executarRA(nome, { nosAnteriores = {}, json = {} } = {}) {
  const $ = (no) => {
    const valor = nosAnteriores[no];
    const lista = [].concat(valor ?? []).map((j) => ({ json: j }));
    return { first: () => lista[0], all: () => lista, item: lista[0] };
  };
  return new Function('$', '$json', '$input', 'DateTime', noRA(nome).parameters.jsCode)($, json, { all: () => [] }, luxon.DateTime);
}
const luxon = { DateTime: { fromISO: (iso) => ({ setZone: () => ({ toFormat: () => `data de ${iso}` }) }) } };
const emailRA = (o) => ({
  id: o.id,
  internetMessageId: `<${o.id}@teste>`,
  subject: o.assunto,
  from: { emailAddress: { name: o.nome ?? 'Fulano', address: o.de } },
  toRecipients: (o.para ?? ['dono@empresa.com.br']).map((address) => ({ emailAddress: { address } })),
  ccRecipients: (o.cc ?? []).map((address) => ({ emailAddress: { address } })),
  receivedDateTime: o.quando ?? '2026-09-28T12:00:00Z',
  body: { contentType: 'text', content: o.texto ?? '' },
  singleValueExtendedProperties: o.verbo ? [{ id: 'Integer 0x1081', value: String(o.verbo) }] : undefined,
  '@odata.type': o.tipo,
});
const separarRA = (caixa, eu = { mail: 'dono@empresa.com.br' }) =>
  executarRA('Separar e-mails', {
    nosAnteriores: {
      Configuração: { max_por_execucao: 5 },
      'Quem sou eu': eu,
      'Buscar e-mails novos': { value: caixa },
      'Já processados': [{ message_id: '<visto@teste>' }],
    },
  }).map((i) => i.json);

teste('rascunhos: só entram e-mails de pedidos, novos, de gente, que você ainda não respondeu', () => {
  const r = separarRA([
    emailRA({ id: 'a1', de: 'compras@cliente.com', assunto: 'Previsão de entrega', texto: 'Qual a previsão do pedido 123456?', quando: '2026-09-28T12:05:00Z' }),
    emailRA({ id: 'a2', de: 'colega@empresa.com.br', assunto: 'Status da TRF 98765', texto: 'Consegue ver?', quando: '2026-09-28T11:00:00Z' }),
    emailRA({ id: 'b1', de: 'no-reply@loja.com', assunto: 'Seu pedido foi enviado', texto: 'Pedido 5555' }),
    emailRA({ id: 'visto', de: 'compras@cliente.com', assunto: 'Pedido 777', texto: 'já visto' }),
    emailRA({ id: 'b2', de: 'dono@empresa.com.br', assunto: 'Pedido 888', texto: 'eu mesmo' }),
    emailRA({ id: 'b3', de: 'amigo@gmail.com', assunto: 'Reunião amanhã', texto: 'Vamos almoçar?' }),
    emailRA({ id: 'b4', de: 'cliente2@x.com', assunto: 'Pedido 999', texto: 'status?', verbo: 102 }),
    emailRA({ id: 'b5', de: 'org@empresa.com.br', assunto: 'Convite: Pedido 1234', tipo: '#microsoft.graph.eventMessageRequest' }),
    emailRA({ id: 'b6', de: 'x@y.com', assunto: 'Resposta automática: Pedido 1', texto: 'fora do escritório' }),
  ]);
  assert.deepEqual(r.map((e) => e.id), ['a2', 'a1']);
  assert.equal(r.find((e) => e.id === 'a1').externo, true);
  assert.equal(r.find((e) => e.id === 'a2').externo, false);
});
teste('rascunhos: corta o histórico citado, marca "só em cópia" e sem saber o dono trata como externo', () => {
  const [e] = separarRA([
    emailRA({ id: 'c1', de: 'chefe@empresa.com.br', assunto: 'RES: OP 12345', para: ['outro@empresa.com.br'], cc: ['dono@empresa.com.br'], texto: 'Andamento?\n\nDe: Outra <o@x.com>\nEnviado: segunda\nAssunto: OP\n\nTexto antigo' }),
  ]);
  assert.equal(e.texto, 'Andamento?');
  assert.equal(e.so_em_copia, true);
  assert.equal(separarRA([emailRA({ id: 'c2', de: 'a@empresa.com.br', assunto: 'Pedido 1', texto: 'x' })], {})[0].externo, true);
});
teste('rascunhos: a resposta da Kira vira rascunho só quando vem no formato combinado', () => {
  const email = { chave: '<a1@teste>', id: 'a1', assunto: 'Pedido 1' };
  const interpretar = (output) => executarRA('Interpretar resposta', { nosAnteriores: { 'Separar e-mails': email }, json: { output } }).json;
  let r = interpretar('```json\n{"responder": true, "resumo": "Previsão [confirmar]", "resposta": "Olá!\\nVerificando [confirmar].\\nBráulio", "consultou": true}\n```');
  assert.equal(r.responder, true);
  assert.equal(r.confirmar, 1);
  assert.equal(r.chave, '<a1@teste>');
  assert.equal(interpretar('{"responder": false, "motivo": "propaganda"}').responder, false);
  assert.equal(interpretar('texto solto').motivo, 'resposta fora do formato');
  assert.equal(interpretar('{"responder": true, "resposta": ""}').responder, false);
});
teste('rascunhos: aviso no Telegram em HTML seguro, com alerta para remetente externo', () => {
  const aviso = (json) => executarRA('Montar aviso', { json }).json.html;
  const html = aviso({ status: 'rascunho', remetente_nome: 'Ana <Cliente>', remetente_email: 'a@c.com', assunto: 'Pedido 1 & 2', resumo: 'Prazo', confirmar: 2, externo: true, link: 'https://outlook.office365.com/owa/?ItemID=X&a=1' });
  assert.equal(htmlValidoParaTelegram(html), true);
  assert.match(html, /2 pontos marcados como \[confirmar\]/);
  assert.match(html, /fora da empresa/);
  assert.match(html, /eu não envio nada/);
  assert.doesNotMatch(aviso({ status: 'rascunho', remetente_email: 'a@c.com', assunto: 'x', confirmar: 0, link: 'javascript:alert(1)' }), /href/);
  assert.equal(htmlValidoParaTelegram(aviso({ status: 'erro', remetente_nome: 'Ana', remetente_email: 'a@c.com', assunto: 'x' })), true);
});
teste('rascunhos: limite de uso da IA não registra (tenta de novo); outros erros registram', () => {
  const falha = (json) => executarRA('Tratar falha da IA', { nosAnteriores: { 'Separar e-mails': { chave: '<a@t>', assunto: 'x' } }, json });
  assert.deepEqual(falha({ error: { message: '[429] RESOURCE_EXHAUSTED' } }), []);
  assert.equal(falha({ error: { message: 'bloqueado pelo filtro' } })[0].json.status, 'erro');
});
teste('rascunhos: seg a sex a cada 30 min, só cria rascunho (createReply) e nunca envia', () => {
  assert.equal(noRA('A cada 30 min (seg a sex, 7h às 19h30)').parameters.rule.interval[0].expression, '*/30 7-19 * * 1-5');
  assert.match(noRA('Criar rascunho').parameters.url, /\/createReply' }}$/);
  const textoTodo = JSON.stringify(rascunhosAuto);
  assert.doesNotMatch(textoTodo, /\/send\b|sendMail/);
  for (const n of rascunhosAuto.nodes.filter((x) => x.parameters?.operation === 'sendMessage')) {
    assert.equal(n.parameters.additionalFields?.appendAttribution, false, n.name);
  }
});
teste('rascunhos: repositório sem chat_id, data de início ou id do sub-workflow de pedidos', () => {
  const cfg = Object.fromEntries(noRA('Configuração').parameters.assignments.assignments.map((c) => [c.name, c.value]));
  assert.equal(cfg.chat_id, '');
  assert.equal(cfg.ativo_desde, '');
  assert.equal(noRA('consultar_pedidos').parameters.workflowId.value, '');
});

teste('segurança: nenhum token do Telegram, chave do Google ou caminho de webhook nos arquivos', () => {
  const arquivos = [
    'n8n/workflows/kira-1.0.json',
    'n8n/sdk/kira-1.0.workflow.ts',
    'n8n/workflows/kira-resumo-da-manha.json',
    'n8n/sdk/kira-resumo-da-manha.workflow.ts',
    'n8n/workflows/kira-gerar-imagem.json',
    'n8n/sdk/kira-gerar-imagem.workflow.ts',
    'n8n/workflows/kira-anexar-imagem.json',
    'n8n/sdk/kira-anexar-imagem.workflow.ts',
    'n8n/workflows/kira-teams.json',
    'n8n/sdk/kira-teams.workflow.ts',
    'n8n/workflows/kira-pedidos.json',
    'n8n/sdk/kira-pedidos.workflow.ts',
    'n8n/workflows/kira-rascunhos-automaticos.json',
    'n8n/sdk/kira-rascunhos-automaticos.workflow.ts',
  ];
  for (const arquivo of arquivos) {
    const conteudo = ler(arquivo);
    assert.doesNotMatch(conteudo, /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/, `${arquivo}: parece um token de bot do Telegram`);
    assert.doesNotMatch(conteudo, /AIza[0-9A-Za-z_-]{35}/, `${arquivo}: parece uma chave de API do Google`);
    assert.doesNotMatch(conteudo, /"webhookId"/, `${arquivo}: não versione o caminho do webhook`);
  }
});

await Promise.all(pendentes);
console.log(falhas ? `\n${falhas} teste(s) falharam` : '\nTodos os testes passaram');
process.exit(falhas ? 1 : 0);
