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
const entradaNormalizada = {
  chat_id: '111',
  user_id: '111',
  nome_usuario: 'Bráulio',
  texto: 'Kira, bom dia. Você está online?',
  comando: '',
  tipo_entrada: 'voz',
};

let falhas = 0;
function teste(nome, fn) {
  try {
    fn();
    console.log(`ok    ${nome}`);
  } catch (erro) {
    falhas += 1;
    console.log(`FALHA ${nome}\n      ${erro.message}`);
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

teste('comando /memorias lista id, categoria e fato', () => {
  const r = comando('/memorias', [{ id: 7, categoria: 'pessoal', fato: 'Prefere respostas curtas' }]);
  assert.match(partes(r.texto_resposta)[0].html, /• \[7\] \(pessoal\) Prefere respostas curtas/);
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
teste('comando /status e /ajuda mostram as imagens', () => {
  assert.match(comando('/status').texto_resposta, /Imagens: gero com o Gemini/);
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
  for (const secao of ['Brasil', 'Mundo', 'Mercado financeiro', 'Política', 'Tecnologia e tendências']) {
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
teste('resumo: repositório sem chat_id preenchido', () => {
  const chat = nosResumo['Configuração do resumo'].parameters.assignments.assignments.find((a) => a.name === 'chat_id');
  assert.equal(chat.value, '');
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
  ];
  for (const arquivo of arquivos) {
    const conteudo = ler(arquivo);
    assert.doesNotMatch(conteudo, /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/, `${arquivo}: parece um token de bot do Telegram`);
    assert.doesNotMatch(conteudo, /AIza[0-9A-Za-z_-]{35}/, `${arquivo}: parece uma chave de API do Google`);
    assert.doesNotMatch(conteudo, /"webhookId"/, `${arquivo}: não versione o caminho do webhook`);
  }
});

console.log(falhas ? `\n${falhas} teste(s) falharam` : '\nTodos os testes passaram');
process.exit(falhas ? 1 : 0);
