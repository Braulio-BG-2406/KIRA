// Kira — Resumo da manhã: todo dia às 7h lê notícias de fontes confiáveis (RSS),
// pega as cotações do dia, pede ao Gemini um resumo curto por seção e manda no Telegram.
// Mesma definição de n8n/workflows/kira-resumo-da-manha.json (para importar no n8n, use o JSON).
import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const credTelegram = { id: 'ox55jLJMBQJ3Pxnc', name: 'Telegram account' };
const credGemini = { id: 'AozFk3svOpYjS2K7', name: 'Google Gemini(PaLM) Api account' };

const todoDia = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.4,
  config: {
    name: 'Todo dia às 7h',
    parameters: { rule: { interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 7, triggerAtMinute: 0 }] } },
    position: [0, 300],
  },
  output: [{ timestamp: '2026-09-27T07:00:00.000-03:00' }],
});

const configuracao = node({
  type: 'n8n-nodes-base.set',
  version: 3.5,
  config: {
    name: 'Configuração do resumo',
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'r-nome', name: 'nome_dono', value: 'Bráulio', type: 'string' },
          { id: 'r-chat', name: 'chat_id', value: '', type: 'string' },
          { id: 'r-itens', name: 'itens_por_fonte', value: 6, type: 'number' },
          { id: 'r-horas', name: 'horas', value: 24, type: 'number' },
          { id: 'r-fuso', name: 'fuso_horario', value: 'America/Sao_Paulo', type: 'string' },
        ],
      },
    },
    position: [220, 300],
  },
  output: [{ nome_dono: 'Bráulio', chat_id: '111111111', itens_por_fonte: 6, horas: 24, fuso_horario: 'America/Sao_Paulo' }],
});

const fontes = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Fontes',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Fontes do resumo da manhã: feeds RSS de veículos confiáveis, separados por seção.\n// Para trocar ou acrescentar fontes, edite esta lista (secao, fonte e url do RSS).\nconst fontes = [\n  { secao: 'Brasil', fonte: 'g1', url: 'https://g1.globo.com/rss/g1/' },\n  { secao: 'Brasil', fonte: 'Agência Brasil', url: 'https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml' },\n  { secao: 'Brasil', fonte: 'BBC News Brasil', url: 'https://feeds.bbci.co.uk/portuguese/rss.xml' },\n  { secao: 'Mundo', fonte: 'g1 Mundo', url: 'https://g1.globo.com/rss/g1/mundo/' },\n  { secao: 'Mundo', fonte: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },\n  { secao: 'Mundo', fonte: 'DW Brasil', url: 'https://rss.dw.com/rdf/rss-br-all' },\n  { secao: 'Mercado financeiro', fonte: 'InfoMoney', url: 'https://www.infomoney.com.br/feed/' },\n  { secao: 'Mercado financeiro', fonte: 'g1 Economia', url: 'https://g1.globo.com/rss/g1/economia/' },\n  { secao: 'Mercado financeiro', fonte: 'Money Times', url: 'https://www.moneytimes.com.br/feed/' },\n  { secao: 'Política', fonte: 'g1 Política', url: 'https://g1.globo.com/rss/g1/politica/' },\n  { secao: 'Política', fonte: 'Poder360', url: 'https://www.poder360.com.br/feed/' },\n  { secao: 'Política', fonte: 'Agência Brasil Política', url: 'https://agenciabrasil.ebc.com.br/rss/politica/feed.xml' },\n  { secao: 'Tecnologia e tendências', fonte: 'Tecnoblog', url: 'https://tecnoblog.net/feed/' },\n  { secao: 'Tecnologia e tendências', fonte: 'g1 Tecnologia', url: 'https://g1.globo.com/rss/g1/tecnologia/' },\n  { secao: 'Tecnologia e tendências', fonte: 'TechCrunch', url: 'https://techcrunch.com/feed/' },\n  { secao: 'Tecnologia e tendências', fonte: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/' },\n];\n\nreturn fontes.map((fonte) => ({ json: fonte }));\n" },
    position: [440, 300],
  },
  output: [{ secao: 'Brasil', fonte: 'g1', url: 'https://g1.globo.com/rss/g1/' }],
});

const lerNoticias = node({
  type: 'n8n-nodes-base.rssFeedRead',
  version: 1.2,
  config: {
    name: 'Ler notícias (RSS)',
    parameters: { url: expr('{{ $json.url }}'), options: {} },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    position: [660, 300],
  },
  output: [{ title: 'Exemplo de notícia', link: 'https://g1.globo.com/exemplo', isoDate: '2026-09-27T09:00:00.000Z', contentSnippet: 'Trecho da notícia.' }],
});

const selecionar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Selecionar notícias',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Junta as notícias de todas as fontes: fica só com as mais recentes, tira as\n// repetidas e limita a quantidade por fonte, para o resumo ficar leve e atual.\nconst config = $('Configuração do resumo').first().json;\nconst limitePorFonte = Number(config.itens_por_fonte) || 6;\nconst desde = Date.now() - (Number(config.horas) || 24) * 60 * 60 * 1000;\nconst SECOES = ['Brasil', 'Mundo', 'Mercado financeiro', 'Política', 'Tecnologia e tendências'];\n\nconst limpar = (s) => String(s ?? '').replace(/\\s+/g, ' ').trim();\nconst chave = (s) => limpar(s).toLowerCase().normalize('NFD').replace(/[^a-z0-9 ]/g, '');\n\nconst porFonte = new Map();\nconst falhas = new Set();\nconst vistos = new Set();\n\n$input.all().forEach((item, i) => {\n  const fonte = $('Fontes').itemMatching(i)?.json;\n  if (!fonte) return;\n  const n = item.json;\n  if (n.error || !n.title) {\n    if (n.error) falhas.add(fonte.fonte);\n    return;\n  }\n  const data = Date.parse(n.isoDate || n.pubDate || '');\n  if (Number.isFinite(data) && data < desde) return;\n  const titulo = limpar(n.title);\n  if (vistos.has(chave(titulo))) return;\n  const lista = porFonte.get(fonte.fonte) ?? [];\n  if (lista.length >= limitePorFonte) return;\n  vistos.add(chave(titulo));\n  lista.push({\n    secao: fonte.secao,\n    fonte: fonte.fonte,\n    titulo,\n    resumo: limpar(n.contentSnippet || n.content || '').slice(0, 240),\n    link: limpar(n.link),\n    data: Number.isFinite(data) ? new Date(data).toISOString() : '',\n  });\n  porFonte.set(fonte.fonte, lista);\n});\n\nconst noticias = [...porFonte.values()].flat();\nconst texto = SECOES.map((secao) => {\n  const daSecao = noticias.filter((n) => n.secao === secao);\n  const linhas = daSecao.map((n) => `- [${n.fonte}] ${n.titulo}${n.resumo ? ' — ' + n.resumo : ''} (${n.link})`);\n  return `## ${secao}\\n${linhas.join('\\n') || '(nenhuma notícia recente)'}`;\n}).join('\\n\\n');\n\nreturn [{ json: { total: noticias.length, noticias, texto, falhas: [...falhas] } }];\n" },
    position: [880, 300],
  },
  output: [{ total: 1, noticias: [], texto: '## Brasil\n- [g1] Exemplo de notícia (https://g1.globo.com/exemplo)', falhas: [] }],
});

const cotacoes = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Cotações do dia',
    parameters: {
      method: 'GET',
      url: 'https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,BTC-BRL',
      options: { timeout: 15000 },
    },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    position: [1100, 300],
  },
  output: [{ USDBRL: { bid: '5.43', pctChange: '-0.35' } }],
});

const montarPedido = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar pedido',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Prepara o pedido para o Gemini: a data, as cotações do dia e as notícias selecionadas.\nconst config = $('Configuração do resumo').first().json;\nconst selecao = $('Selecionar notícias').first().json;\nconst cotacoesApi = $input.first().json ?? {};\n\nconst numero = (v) =>\n  Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });\nfunction cotacao(codigo, nome) {\n  const moeda = cotacoesApi[codigo];\n  if (!moeda?.bid || !Number.isFinite(Number(moeda.bid))) return '';\n  const variacao = Number(moeda.pctChange);\n  const sinal = variacao >= 0 ? '+' : '';\n  return `${nome} R$ ${numero(moeda.bid)}` + (Number.isFinite(variacao) ? ` (${sinal}${numero(variacao)}%)` : '');\n}\nconst cotacoes = [cotacao('USDBRL', 'Dólar'), cotacao('EURBRL', 'Euro'), cotacao('BTCBRL', 'Bitcoin')]\n  .filter(Boolean)\n  .join(' · ');\n\nconst hoje = DateTime.now()\n  .setZone(config.fuso_horario || 'America/Sao_Paulo')\n  .setLocale('pt-BR')\n  .toFormat(\"cccc, dd 'de' LLLL 'de' yyyy\");\n\nconst pedido = [\n  `Data: ${hoje}`,\n  `Cotações: ${cotacoes || 'indisponíveis'}`,\n  '',\n  'Notícias (formato: - [fonte] título — trecho (link)):',\n  '',\n  selecao.texto,\n].join('\\n');\n\nreturn [{ json: { pedido, cotacoes, hoje, total_noticias: selecao.total } }];\n" },
    position: [1320, 300],
  },
  output: [{ pedido: 'Data: ...', cotacoes: 'Dólar R$ 5,43 (-0,35%)', hoje: 'domingo, 27 de setembro de 2026', total_noticias: 1 }],
});

const instrucoesResumo =
  'Você é a Kira, assistente pessoal do {{ $(\'Configuração do resumo\').first().json.nome_dono }}. Escreva o resumo de notícias da manhã dele, em português do Brasil, usando SOMENTE as notícias e as cotações recebidas. Não invente fatos, números, nomes nem datas e não use conhecimento de fora da lista.\n' +
  '\n' +
  'Formato (Markdown simples, sem tabelas e sem títulos com #):\n' +
  '☀️ **Bom dia, {{ $(\'Configuração do resumo\').first().json.nome_dono }}!** Resumo de <data recebida>.\n' +
  '💱 <as cotações, numa linha, exatamente como recebidas; se estiverem indisponíveis, omita esta linha>\n' +
  '\n' +
  'Depois, estas seções, nesta ordem, cada uma com o título em negrito numa linha própria:\n' +
  '🇧🇷 **Brasil**\n' +
  '🌎 **Mundo**\n' +
  '💰 **Mercado financeiro**\n' +
  '🏛️ **Política**\n' +
  '💡 **Tecnologia e tendências**\n' +
  '\n' +
  'Regras:\n' +
  '- Em cada seção, de 3 a 5 itens, os mais importantes primeiro. Cada item: "- " + uma frase curta e objetiva com o fato principal + " ([Fonte](link))", com o nome da fonte e o link exato da notícia.\n' +
  '- Junte notícias sobre o mesmo fato num item só e não repita a mesma notícia em duas seções.\n' +
  '- Mercado financeiro: priorize juros, inflação, câmbio, bolsa e empresas brasileiras. Tecnologia e tendências: priorize o que muda mercados e negócios.\n' +
  '- Notícias em inglês: escreva o item em português.\n' +
  '- Se uma seção não tiver notícias, escreva "- Sem novidades nas fontes de hoje."\n' +
  '- No máximo 3.500 caracteres no total.';

const resumir = node({
  type: '@n8n/n8n-nodes-langchain.googleGemini',
  version: 1.2,
  config: {
    name: 'Resumir (Gemini)',
    parameters: {
      resource: 'text',
      operation: 'message',
      modelId: { __rl: true, mode: 'id', value: 'models/gemini-flash-latest' },
      messages: { values: [{ content: expr('{{ $json.pedido }}'), role: 'user' }] },
      simplify: true,
      jsonOutput: false,
      options: { systemMessage: expr(instrucoesResumo), temperature: 0.3, maxOutputTokens: 8192, includeMergedResponse: true },
    },
    credentials: { googlePalmApi: credGemini },
    onError: 'continueErrorOutput',
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 5000,
    position: [1540, 300],
  },
  output: [{ mergedResponse: '☀️ **Bom dia, Bráulio!** Resumo de domingo.' }],
});

const reserva = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Resumo reserva (só títulos)',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Plano B: se o Gemini falhar (limite do plano gratuito, por exemplo), manda os\n// principais títulos de cada seção, com link, sem o resumo escrito pela IA.\nconst selecao = $('Selecionar notícias').first().json;\nconst config = $('Configuração do resumo').first().json;\nconst SECOES = [\n  ['Brasil', '🇧🇷'],\n  ['Mundo', '🌎'],\n  ['Mercado financeiro', '💰'],\n  ['Política', '🏛️'],\n  ['Tecnologia e tendências', '💡'],\n];\n\nconst partes = [`☀️ **Bom dia, ${config.nome_dono}!** Hoje não consegui escrever o resumo, então seguem os principais títulos.`];\nfor (const [secao, emoji] of SECOES) {\n  const itens = (selecao.noticias ?? []).filter((n) => n.secao === secao).slice(0, 4);\n  if (!itens.length) continue;\n  partes.push(`${emoji} **${secao}**\\n` + itens.map((n) => `- ${n.titulo} ([${n.fonte}](${n.link}))`).join('\\n'));\n}\nif (partes.length === 1) partes.push('Não consegui ler as fontes de notícias hoje. 😕');\n\nreturn [{ json: { texto: partes.join('\\n\\n') } }];\n" },
    position: [1760, 480],
  },
  output: [{ texto: '☀️ **Bom dia, Bráulio!**' }],
});

const montarMensagem = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar mensagem',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Converte o resumo (Markdown simples) para o HTML aceito pelo Telegram e divide\n// em partes (o Telegram aceita até 4096 caracteres por mensagem).\nconst entrada = $input.first().json;\nconst texto = String(\n  entrada.texto ?? entrada.mergedResponse ?? (entrada.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? '').join(''),\n).trim();\nconst LIMITE = 3500;\n\nconst escapar = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\n\nfunction markdownParaHtml(md) {\n  // Código e links são convertidos antes e guardados, para não serem alterados depois.\n  const guardados = [];\n  const guardar = (html) => `\\u0000${guardados.push(html) - 1}\\u0000`;\n  const t = md\n    .replace(/```[\\w+-]*\\n?([\\s\\S]*?)```/g, (_, codigo) =>\n      guardar(`<pre>${escapar(codigo.replace(/\\n$/, ''))}</pre>`),\n    )\n    .replace(/`([^`\\n]+)`/g, (_, codigo) => guardar(`<code>${escapar(codigo)}</code>`))\n    .replace(/\\[([^\\]\\n]+)\\]\\((https?:\\/\\/[^\\s)]+)\\)/g, (_, rotulo, url) =>\n      guardar(`<a href=\"${escapar(url).replace(/\"/g, '&quot;')}\">${escapar(rotulo)}</a>`),\n    );\n  return escapar(t)\n    .replace(/^[ \\t]*#{1,6}[ \\t]+(.+?)[ \\t#]*$/gm, (_, titulo) => `<b>${titulo.replace(/\\*\\*|__/g, '')}</b>`)\n    .replace(/^([ \\t]*)[*+-][ \\t]+/gm, '$1• ')\n    .replace(/\\*\\*(?=\\S)([^\\n]*?\\S)\\*\\*/g, '<b>$1</b>')\n    .replace(/__(?=\\S)([^\\n]*?\\S)__/g, '<b>$1</b>')\n    .replace(/(^|[^\\w*])\\*(?=\\S)([^*\\n]*?\\S)\\*(?![\\w*])/g, '$1<i>$2</i>')\n    .replace(/(^|[^\\w])_(?=\\S)([^_\\n]*?\\S)_(?!\\w)/g, '$1<i>$2</i>')\n    .replace(/~~(?=\\S)([^~\\n]*?\\S)~~/g, '<s>$1</s>')\n    .replace(/\\u0000(\\d+)\\u0000/g, (_, i) => guardados[Number(i)]);\n}\n\nfunction dividir(t, limite) {\n  const partes = [];\n  let resto = t;\n  while (resto.length > limite) {\n    let corte = resto.lastIndexOf('\\n\\n', limite);\n    if (corte < limite / 2) corte = resto.lastIndexOf('\\n', limite);\n    if (corte < limite / 2) corte = resto.lastIndexOf(' ', limite);\n    if (corte < limite / 2) corte = limite;\n    partes.push(resto.slice(0, corte).trim());\n    resto = resto.slice(corte).trim();\n  }\n  if (resto) partes.push(resto);\n  return partes;\n}\n\nreturn dividir(texto || 'Não consegui montar o resumo de hoje. 😕', LIMITE).map((parte) => ({\n  json: { html: markdownParaHtml(parte), texto_simples: escapar(parte) },\n}));\n" },
    position: [1980, 300],
  },
  output: [{ html: '☀️ <b>Bom dia, Bráulio!</b>', texto_simples: '☀️ **Bom dia, Bráulio!**' }],
});

const enviar = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Enviar resumo',
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr("{{ $('Configuração do resumo').first().json.chat_id }}"),
      text: expr('{{ $json.html }}'),
      additionalFields: { appendAttribution: false, parse_mode: 'HTML', disable_web_page_preview: true },
    },
    credentials: { telegramApi: credTelegram },
    onError: 'continueErrorOutput',
    position: [2200, 300],
  },
  output: [{ ok: true, result: { message_id: 50 } }],
});

const enviarSimples = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Enviar resumo sem formatação',
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr("{{ $('Configuração do resumo').first().json.chat_id }}"),
      text: expr('{{ $json.texto_simples }}'),
      additionalFields: { appendAttribution: false, parse_mode: 'HTML', disable_web_page_preview: true },
    },
    credentials: { telegramApi: credTelegram },
    onError: 'continueRegularOutput',
    position: [2420, 460],
  },
  output: [{ ok: true, result: { message_id: 51 } }],
});

const nota = sticky(
  '## ☀️ Resumo da manhã da Kira\n\n' +
    'Todo dia às **7h** (horário de Brasília): lê notícias de fontes confiáveis por RSS, pega dólar, euro e bitcoin, pede ao Gemini um resumo curto por seção e manda no Telegram.\n\n' +
    '- **chat_id** e **nome_dono**: nó *Configuração do resumo*.\n' +
    '- **Fontes**: lista no nó *Fontes* (seção, nome e RSS).\n' +
    '- Se o Gemini falhar, vão só os títulos com link (nó *Resumo reserva*).\n\n' +
    'Tudo grátis: RSS, AwesomeAPI (cotações) e a chave gratuita do Gemini.',
  { color: 5, position: [-40, -60], width: 520, height: 300, name: 'Sobre este workflow' },
);

export default workflow('kira-resumo-da-manha', 'Kira — Resumo da manhã (7h)', { executionOrder: 'v1', timezone: 'America/Sao_Paulo' })
  .add(todoDia)
  .to(configuracao)
  .to(fontes)
  .to(lerNoticias)
  .to(selecionar)
  .to(cotacoes)
  .to(montarPedido)
  .to(resumir)
  .to(montarMensagem)
  .to(enviar)
  .add(resumir.onError(reserva))
  .add(reserva)
  .to(montarMensagem)
  .add(enviar.onError(enviarSimples))
  .add(nota);
