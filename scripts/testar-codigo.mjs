// Testes da Kira: executa o código dos nós "Code" do workflow exportado
// (n8n/workflows/kira-1.0.json) com dados simulados e confere a estrutura do workflow.
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
