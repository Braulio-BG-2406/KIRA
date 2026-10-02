// Kira — Resumo da manhã: todo dia às 7h lê notícias de fontes confiáveis (RSS),
// pega as cotações do dia, pede ao Gemini um resumo curto por seção e manda no Telegram.
// Mesma definição de n8n/workflows/kira-resumo-da-manha.json (para importar no n8n, use o JSON).
import { workflow, node, trigger, sticky, expr, newCredential } from '@n8n/workflow-sdk';

const credTelegram = newCredential('Telegram');
const credGemini = newCredential('Gemini (Google AI Studio)');

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
          { id: 'r-nome', name: 'nome_dono', value: 'Seu nome', type: 'string' },
          { id: 'r-chat', name: 'chat_id', value: '', type: 'string' },
          { id: 'r-itens', name: 'itens_por_fonte', value: 6, type: 'number' },
          { id: 'r-horas', name: 'horas', value: 24, type: 'number' },
          { id: 'r-fuso', name: 'fuso_horario', value: 'America/Sao_Paulo', type: 'string' },
        ],
      },
    },
    position: [220, 300],
  },
  output: [{ nome_dono: 'Carlos', chat_id: '111111111', itens_por_fonte: 6, horas: 24, fuso_horario: 'America/Sao_Paulo' }],
});

const fontes = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Fontes',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Fontes do resumo da manhã: feeds RSS de veículos confiáveis, separados por seção.\n// Para trocar ou acrescentar fontes, edite esta lista (secao, fonte, url do RSS e, se quiser,\n// limite de notícias por fonte).\nconst SETORES = 'Mineração, petróleo, siderurgia e florestal';\nconst googleNoticias = (busca) =>\n  `https://news.google.com/rss/search?q=${encodeURIComponent(`${busca} when:1d`)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;\n\nconst fontes = [\n  { secao: 'Brasil', fonte: 'g1', url: 'https://g1.globo.com/rss/g1/' },\n  { secao: 'Brasil', fonte: 'Agência Brasil', url: 'https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml' },\n  { secao: 'Brasil', fonte: 'BBC News Brasil', url: 'https://feeds.bbci.co.uk/portuguese/rss.xml' },\n  { secao: 'Mundo', fonte: 'g1 Mundo', url: 'https://g1.globo.com/rss/g1/mundo/' },\n  { secao: 'Mundo', fonte: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },\n  { secao: 'Mundo', fonte: 'DW Brasil', url: 'https://rss.dw.com/rdf/rss-br-all' },\n  { secao: 'Mercado financeiro', fonte: 'InfoMoney', url: 'https://www.infomoney.com.br/feed/' },\n  { secao: 'Mercado financeiro', fonte: 'g1 Economia', url: 'https://g1.globo.com/rss/g1/economia/' },\n  { secao: 'Mercado financeiro', fonte: 'Money Times', url: 'https://www.moneytimes.com.br/feed/' },\n  { secao: 'Política', fonte: 'g1 Política', url: 'https://g1.globo.com/rss/g1/politica/' },\n  { secao: 'Política', fonte: 'Poder360', url: 'https://www.poder360.com.br/feed/' },\n  { secao: 'Política', fonte: 'Agência Brasil Política', url: 'https://agenciabrasil.ebc.com.br/rss/politica/feed.xml' },\n  { secao: 'Tecnologia e tendências', fonte: 'Tecnoblog', url: 'https://tecnoblog.net/feed/' },\n  { secao: 'Tecnologia e tendências', fonte: 'g1 Tecnologia', url: 'https://g1.globo.com/rss/g1/tecnologia/' },\n  { secao: 'Tecnologia e tendências', fonte: 'TechCrunch', url: 'https://techcrunch.com/feed/' },\n  { secao: 'Tecnologia e tendências', fonte: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/' },\n  // Indústria de base: busca do Google Notícias (últimas 24 h; só veículos da lista de confiáveis,\n  // ver \"Selecionar notícias\") e publicações do setor.\n  { secao: SETORES, fonte: 'Google Notícias: mineração', url: googleNoticias('mineração OR mineradora OR \"minério de ferro\" OR \"setor mineral\"'), limite: 4 },\n  { secao: SETORES, fonte: 'Google Notícias: petróleo', url: googleNoticias('petróleo OR Petrobras OR \"óleo e gás\" OR \"pré-sal\" OR ANP'), limite: 4 },\n  { secao: SETORES, fonte: 'Google Notícias: siderurgia', url: googleNoticias('siderurgia OR siderúrgica OR \"aço bruto\" OR \"Aço Brasil\" OR Usiminas OR Gerdau OR ArcelorMittal -futebol -campeonato'), limite: 4 },\n  { secao: SETORES, fonte: 'Google Notícias: florestal', url: googleNoticias('\"setor florestal\" OR celulose OR \"base florestal\" OR silvicultura OR \"papel e celulose\" OR Klabin'), limite: 4 },\n  { secao: SETORES, fonte: 'Petronotícias', url: 'https://petronoticias.com.br/feed/', limite: 3 },\n  { secao: SETORES, fonte: 'Brasil Mineral', url: 'https://www.brasilmineral.com.br/feed/', limite: 3 },\n  { secao: SETORES, fonte: 'GMK Center', url: 'https://gmk.center/en/feed/', limite: 3 },\n  { secao: SETORES, fonte: 'Painel Florestal', url: 'https://www.painelflorestal.com.br/feed', limite: 3 },\n];\n\nreturn fontes.map((fonte) => ({ json: fonte }));\n" },
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
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Junta as notícias de todas as fontes: fica só com as mais recentes, tira as\n// repetidas e limita a quantidade por fonte, para o resumo ficar leve e atual.\nconst config = $('Configuração do resumo').first().json;\nconst limitePorFonte = Number(config.itens_por_fonte) || 6;\nconst desde = Date.now() - (Number(config.horas) || 24) * 60 * 60 * 1000;\nconst SECOES = ['Brasil', 'Mundo', 'Mercado financeiro', 'Mineração, petróleo, siderurgia e florestal', 'Política', 'Tecnologia e tendências'];\n\nconst limpar = (s) => String(s ?? '').replace(/\\s+/g, ' ').trim();\nconst chave = (s) => limpar(s).toLowerCase().normalize('NFD').replace(/[^a-z0-9 ]/g, '');\n\n// Veículos aceitos nas buscas do Google Notícias (grande imprensa, agências e mídia do setor).\nconst CONFIAVEIS = [\n  'valor', 'estadao', 'g1', 'o globo', 'globo', 'exame', 'infomoney', 'folha', 'cnn brasil', 'poder360',\n  'money times', 'brazil journal', 'agencia brasil', 'reuters', 'bloomberg', 'veja', 'isto e dinheiro',\n  'istoe dinheiro', 'epoca negocios', 'forbes', 'neofeed', 'uol', 'bbc', 'estado de minas',\n  'diario do comercio', 'correio braziliense', 'jota', 'petronoticias', 'epbr', 'eixos', 'brasil energia',\n  'petroleo hoje', 'brasil mineral', 'noticias de mineracao', 'in the mine', 'bnamericas', 'mining com',\n  'painel florestal', 'celuloseonline', 'celulose online', 'revista o papel', 'aco brasil', 'siderurgia brasil',\n  'gmk center', 'fastmarkets', 'argus', 's p global',\n];\nconst confiavel = (veiculo) => {\n  const nome = chave(veiculo);\n  return CONFIAVEIS.some((c) => nome === c || nome.startsWith(`${c} `));\n};\n\nconst porFonte = new Map();\nconst falhas = new Set();\nconst vistos = new Set();\n\n$input.all().forEach((item, i) => {\n  const fonte = $('Fontes').itemMatching(i)?.json;\n  if (!fonte) return;\n  const n = item.json;\n  if (n.error || !n.title) {\n    if (n.error) falhas.add(fonte.fonte);\n    return;\n  }\n  const data = Date.parse(n.isoDate || n.pubDate || '');\n  if (Number.isFinite(data) && data < desde) return;\n  let titulo = limpar(n.title);\n  let veiculo = fonte.fonte;\n  // Google Notícias: o título vem como \"Título - Veículo\"; o veículo vira a fonte citada.\n  if (fonte.fonte.startsWith('Google Notícias')) {\n    const partes = titulo.match(/^(.+) - ([^-]{2,60})$/);\n    if (!partes || !confiavel(partes[2])) return;\n    [, titulo, veiculo] = partes.map(limpar);\n  }\n  if (vistos.has(chave(titulo))) return;\n  const lista = porFonte.get(fonte.fonte) ?? [];\n  if (lista.length >= (Number(fonte.limite) || limitePorFonte)) return;\n  vistos.add(chave(titulo));\n  lista.push({\n    secao: fonte.secao,\n    fonte: veiculo,\n    titulo,\n    resumo: limpar(n.contentSnippet || n.content || '').slice(0, 240),\n    link: limpar(n.link),\n    data: Number.isFinite(data) ? new Date(data).toISOString() : '',\n  });\n  porFonte.set(fonte.fonte, lista);\n});\n\nconst noticias = [...porFonte.values()].flat();\nconst texto = SECOES.map((secao) => {\n  const daSecao = noticias.filter((n) => n.secao === secao);\n  const linhas = daSecao.map((n) => `- [${n.fonte}] ${n.titulo}${n.resumo ? ' — ' + n.resumo : ''} (${n.link})`);\n  return `## ${secao}\\n${linhas.join('\\n') || '(nenhuma notícia recente)'}`;\n}).join('\\n\\n');\n\nreturn [{ json: { total: noticias.length, noticias, texto, falhas: [...falhas] } }];\n" },
    position: [880, 300],
  },
  output: [{ total: 1, noticias: [], texto: '## Brasil\n- [g1] Exemplo de notícia (https://g1.globo.com/exemplo)', falhas: [] }],
});

const cotacoes = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Cotações do dia',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Cotações do dia: dólar e euro do Banco Central (PTAX de venda, último dia útil, variação\n// sobre o dia útil anterior) e bitcoin da Coinbase (variação sobre ontem).\n// Cada fonte é consultada separadamente: se uma falhar, o resumo sai sem ela.\nconst pedir = (url) => this.helpers.httpRequest({ method: 'GET', url, json: true, timeout: 15000 });\nconst variacao = (atual, anterior) => (Number.isFinite(anterior) && anterior ? ((atual - anterior) / anterior) * 100 : undefined);\n\nasync function serieDoBancoCentral(codigo) {\n  const dados = await pedir(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados/ultimos/2?formato=json`);\n  const valores = (Array.isArray(dados) ? dados : []).map((d) => Number(String(d.valor).replace(',', '.'))).filter(Number.isFinite);\n  if (!valores.length) throw new Error('série sem valores');\n  const atual = valores[valores.length - 1];\n  return { bid: atual, pctChange: variacao(atual, valores[valores.length - 2]), data: dados[dados.length - 1]?.data };\n}\n\nasync function bitcoin() {\n  const agora = await pedir('https://api.coinbase.com/v2/prices/BTC-BRL/spot');\n  const bid = Number(agora?.data?.amount);\n  if (!Number.isFinite(bid)) throw new Error('sem preço');\n  let pctChange;\n  try {\n    const ontem = DateTime.now().setZone('America/Sao_Paulo').minus({ days: 1 }).toFormat('yyyy-LL-dd');\n    const antes = await pedir(`https://api.coinbase.com/v2/prices/BTC-BRL/spot?date=${ontem}`);\n    pctChange = variacao(bid, Number(antes?.data?.amount));\n  } catch (e) {\n    pctChange = undefined;\n  }\n  return { bid, pctChange };\n}\n\nconst cotacoes = {};\nconst falhas = [];\nfor (const [codigo, buscar] of [\n  ['USDBRL', () => serieDoBancoCentral(1)],\n  ['EURBRL', () => serieDoBancoCentral(21619)],\n  ['BTCBRL', bitcoin],\n]) {\n  try {\n    cotacoes[codigo] = await buscar();\n  } catch (e) {\n    falhas.push(`${codigo}: ${e.message}`);\n  }\n}\nreturn [{ json: { ...cotacoes, falhas } }];\n" },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    position: [1100, 300],
  },
  output: [{ USDBRL: { bid: 5.43, pctChange: -0.35 }, EURBRL: { bid: 5.93, pctChange: 0.63 }, BTCBRL: { bid: 439654, pctChange: 0.91 }, falhas: [] }],
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
  '🏭 **Mineração, petróleo, siderurgia e florestal**\n' +
  '🏛️ **Política**\n' +
  '💡 **Tecnologia e tendências**\n' +
  '\n' +
  'Regras:\n' +
  '- Em cada seção, de 3 a 5 itens, os mais importantes primeiro. Cada item: "- " + uma frase curta e objetiva com o fato principal + " ([Fonte](link))", com o nome da fonte e o link exato da notícia.\n' +
  '- Junte notícias sobre o mesmo fato num item só e não repita a mesma notícia em duas seções.\n' +
  '- Mercado financeiro: priorize juros, inflação, câmbio, bolsa e empresas brasileiras. Tecnologia e tendências: priorize o que muda mercados e negócios.\n' +
  '- Mineração, petróleo, siderurgia e florestal: um panorama dos quatro setores (produção, preços do minério de ferro, do petróleo, do aço e da celulose, investimentos, grandes empresas e efeitos no Brasil), com pelo menos um item de cada setor quando houver notícia. Pode ter até 6 itens.\n' +
  '- Notícias em inglês: escreva o item em português.\n' +
  '- Se uma seção não tiver notícias, escreva "- Sem novidades nas fontes de hoje."\n' +
  '- No máximo 4.000 caracteres no total.';

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
  output: [{ mergedResponse: '☀️ **Bom dia, Carlos!** Resumo de domingo.' }],
});

const reserva = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Resumo reserva (só títulos)',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Plano B: se o Gemini falhar (limite do plano gratuito, por exemplo), manda os\n// principais títulos de cada seção, com link, sem o resumo escrito pela IA.\nconst selecao = $('Selecionar notícias').first().json;\nconst config = $('Configuração do resumo').first().json;\nconst SECOES = [\n  ['Brasil', '🇧🇷'],\n  ['Mundo', '🌎'],\n  ['Mercado financeiro', '💰'],\n  ['Mineração, petróleo, siderurgia e florestal', '🏭'],\n  ['Política', '🏛️'],\n  ['Tecnologia e tendências', '💡'],\n];\n\nconst partes = [`☀️ **Bom dia, ${config.nome_dono}!** Hoje não consegui escrever o resumo, então seguem os principais títulos.`];\nfor (const [secao, emoji] of SECOES) {\n  const itens = (selecao.noticias ?? []).filter((n) => n.secao === secao).slice(0, 4);\n  if (!itens.length) continue;\n  partes.push(`${emoji} **${secao}**\\n` + itens.map((n) => `- ${n.titulo} ([${n.fonte}](${n.link}))`).join('\\n'));\n}\nif (partes.length === 1) partes.push('Não consegui ler as fontes de notícias hoje. 😕');\n\nreturn [{ json: { texto: partes.join('\\n\\n') } }];\n" },
    position: [1760, 480],
  },
  output: [{ texto: '☀️ **Bom dia, Carlos!**' }],
});

const montarMensagem = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar mensagem',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Converte o resumo (Markdown simples) para o HTML aceito pelo Telegram e divide\n// em partes (o Telegram aceita até 4096 caracteres por mensagem).\nconst entrada = $input.first().json;\nconst texto = String(\n  entrada.texto ?? entrada.mergedResponse ?? (entrada.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? '').join(''),\n).trim();\nconst LIMITE = 3500;\n\nconst escapar = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\n\nfunction markdownParaHtml(md) {\n  // Código e links são convertidos antes e guardados, para não serem alterados depois.\n  const guardados = [];\n  const guardar = (html) => `\\u0000${guardados.push(html) - 1}\\u0000`;\n  const t = md\n    .replace(/```[\\w+-]*\\n?([\\s\\S]*?)```/g, (_, codigo) =>\n      guardar(`<pre>${escapar(codigo.replace(/\\n$/, ''))}</pre>`),\n    )\n    .replace(/`([^`\\n]+)`/g, (_, codigo) => guardar(`<code>${escapar(codigo)}</code>`))\n    .replace(/\\[([^\\]\\n]+)\\]\\((https?:\\/\\/[^\\s)]+)\\)/g, (_, rotulo, url) =>\n      guardar(`<a href=\"${escapar(url).replace(/\"/g, '&quot;')}\">${escapar(rotulo)}</a>`),\n    );\n  return escapar(t)\n    .replace(/^[ \\t]*#{1,6}[ \\t]+(.+?)[ \\t#]*$/gm, (_, titulo) => `<b>${titulo.replace(/\\*\\*|__/g, '')}</b>`)\n    .replace(/^([ \\t]*)[*+-][ \\t]+/gm, '$1• ')\n    .replace(/\\*\\*(?=\\S)([^\\n]*?\\S)\\*\\*/g, '<b>$1</b>')\n    .replace(/__(?=\\S)([^\\n]*?\\S)__/g, '<b>$1</b>')\n    .replace(/(^|[^\\w*])\\*(?=\\S)([^*\\n]*?\\S)\\*(?![\\w*])/g, '$1<i>$2</i>')\n    .replace(/(^|[^\\w])_(?=\\S)([^_\\n]*?\\S)_(?!\\w)/g, '$1<i>$2</i>')\n    .replace(/~~(?=\\S)([^~\\n]*?\\S)~~/g, '<s>$1</s>')\n    .replace(/\\u0000(\\d+)\\u0000/g, (_, i) => guardados[Number(i)]);\n}\n\nfunction dividir(t, limite) {\n  const partes = [];\n  let resto = t;\n  while (resto.length > limite) {\n    let corte = resto.lastIndexOf('\\n\\n', limite);\n    if (corte < limite / 2) corte = resto.lastIndexOf('\\n', limite);\n    if (corte < limite / 2) corte = resto.lastIndexOf(' ', limite);\n    if (corte < limite / 2) corte = limite;\n    partes.push(resto.slice(0, corte).trim());\n    resto = resto.slice(corte).trim();\n  }\n  if (resto) partes.push(resto);\n  return partes;\n}\n\nreturn dividir(texto || 'Não consegui montar o resumo de hoje. 😕', LIMITE).map((parte) => ({\n  json: { html: markdownParaHtml(parte), texto_simples: escapar(parte) },\n}));\n" },
    position: [1980, 300],
  },
  output: [{ html: '☀️ <b>Bom dia, Carlos!</b>', texto_simples: '☀️ **Bom dia, Carlos!**' }],
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

// Áudio: depois do texto, a Kira manda o resumo falado (roteiro curto do Gemini + voz do Gemini).
const textoParaVoz = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Texto para a voz',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Pega o resumo do dia (do Gemini ou, se ele falhou, a reserva só com títulos) e tira os links,\n// para virar o roteiro falado da Kira.\nconst executou = (no) => {\n  try {\n    return Boolean($(no).isExecuted);\n  } catch (e) {\n    return false;\n  }\n};\nlet texto = '';\nif (executou('Resumir (Gemini)')) {\n  const r = $('Resumir (Gemini)').first()?.json ?? {};\n  texto = r.mergedResponse ?? (r.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? '').join('');\n}\nif (!String(texto ?? '').trim() && executou('Resumo reserva (só títulos)')) {\n  texto = $('Resumo reserva (só títulos)').first()?.json?.texto ?? '';\n}\nconst resumo = String(texto ?? '')\n  .replace(/\\[([^\\]\\n]+)\\]\\((https?:\\/\\/[^\\s)]+)\\)/g, '$1')\n  .replace(/\\(?https?:\\/\\/[^\\s)]+\\)?/g, '')\n  .replace(/[ \\t]+\\n/g, '\\n')\n  .trim();\nif (!resumo) throw new Error('Sem resumo para transformar em áudio.');\nreturn [{ json: { resumo, nome: $('Configuração do resumo').first().json.nome_dono || '' } }];\n" },
    onError: 'continueErrorOutput',
    position: [2420, 140],
  },
  output: [{ resumo: '☀️ **Bom dia, Carlos!** Resumo de domingo.', nome: 'Carlos' }],
});

const instrucoesRoteiro =
  'Você é a Kira, assistente pessoal do {{ $json.nome }}. Transforme o resumo de notícias recebido em um roteiro para ser FALADO pela sua voz, como um boletim de rádio curto, em português do Brasil.\n' +
  '\n' +
  'Regras:\n' +
  '- Comece com: "Bom dia, {{ $json.nome }}! Aqui é a Kira com o seu resumo da manhã."\n' +
  '- Depois, as cotações (se vieram no resumo) e os destaques na ordem: Brasil, Mundo, Mercado financeiro, mineração, petróleo, siderurgia e florestal, Política e Tecnologia. Uma ou duas frases por seção, só o mais importante.\n' +
  '- Frases curtas e naturais. Sem links, emojis, listas, títulos, asteriscos ou símbolos. Escreva "por cento" no lugar de "%" e valores em reais como se fala (por exemplo, "cinco reais e vinte centavos").\n' +
  '- No máximo 1.500 caracteres, cerca de um minuto e meio de fala.\n' +
  '- Termine com uma despedida curta, como "Tenha um ótimo dia!".\n' +
  '- Use somente as informações do resumo, sem inventar nada.\n' +
  'Responda só com o roteiro.';

const roteiroVoz = node({
  type: '@n8n/n8n-nodes-langchain.googleGemini',
  version: 1.2,
  config: {
    name: 'Roteiro da voz (Gemini)',
    parameters: {
      resource: 'text',
      operation: 'message',
      modelId: { __rl: true, mode: 'id', value: 'models/gemini-flash-latest' },
      messages: { values: [{ content: expr('{{ $json.resumo }}'), role: 'user' }] },
      simplify: true,
      jsonOutput: false,
      options: { systemMessage: expr(instrucoesRoteiro), temperature: 0.4, maxOutputTokens: 8192, includeMergedResponse: true },
    },
    credentials: { googlePalmApi: credGemini },
    onError: 'continueErrorOutput',
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 5000,
    position: [2640, 140],
  },
  output: [{ mergedResponse: 'Bom dia, Carlos! Aqui é a Kira com o seu resumo da manhã.' }],
});

const vozResumo = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Voz do resumo (Gemini)',
    parameters: {
      method: 'POST',
      url: expr("{{ 'https://generativelanguage.googleapis.com/v1beta/models/' + ($('Configuração do resumo').first().json.modelo_voz || 'gemini-3.8-flash-tts') + ':generateContent' }}"),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googlePalmApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(
        "{{ JSON.stringify({ contents: [{ parts: [{ text: String($json.mergedResponse ?? ($json.content?.parts ?? []).filter(p => !p.thought).map(p => p.text ?? '').join('')).trim().slice(0, 2000) }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: $('Configuração do resumo').first().json.voz_tts || 'Kore' } } } } }) }}",
      ),
      options: { timeout: 120000 },
    },
    credentials: { googlePalmApi: credGemini },
    onError: 'continueErrorOutput',
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 5000,
    position: [2860, 140],
  },
  output: [{ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/wav', data: 'UklGRg==' } }] } }] }],
});

const prepararAudio = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Preparar áudio (WAV)',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Pega o áudio devolvido pelo Gemini (voz) e entrega um arquivo WAV para o Telegram.\n// Os modelos de voz do Gemini devolvem WAV pronto ou áudio \"cru\" (PCM 16 bits, mono);\n// no segundo caso, este nó acrescenta o cabeçalho WAV.\nconst resposta = $input.first().json;\nconst partes = resposta.candidates?.[0]?.content?.parts ?? [];\nconst audio = partes.find((p) => p.inlineData?.data)?.inlineData;\nif (!audio) {\n  throw new Error('O Gemini não devolveu áudio: ' + JSON.stringify(resposta).slice(0, 300));\n}\n\nconst bytes = Buffer.from(audio.data, 'base64');\nconst jaEhWav = bytes.subarray(0, 4).toString('ascii') === 'RIFF';\n\nlet wav = bytes;\nconst taxa = Number((String(audio.mimeType).match(/rate=(\\d+)/) || [])[1]) || 24000;\nlet bytesPorSegundo = taxa * 2;\nlet tamanhoAudio = bytes.length;\n\nif (jaEhWav) {\n  // Lê a taxa do próprio cabeçalho e o tamanho do bloco de áudio (\"data\").\n  bytesPorSegundo = bytes.readUInt32LE(28) || bytesPorSegundo;\n  let i = 12;\n  while (i + 8 <= bytes.length) {\n    const bloco = bytes.subarray(i, i + 4).toString('ascii');\n    const tamanho = bytes.readUInt32LE(i + 4);\n    if (bloco === 'data') {\n      tamanhoAudio = tamanho;\n      break;\n    }\n    i += 8 + tamanho + (tamanho % 2);\n  }\n} else {\n  const cabecalho = Buffer.alloc(44);\n  cabecalho.write('RIFF', 0);\n  cabecalho.writeUInt32LE(36 + bytes.length, 4);\n  cabecalho.write('WAVE', 8);\n  cabecalho.write('fmt ', 12);\n  cabecalho.writeUInt32LE(16, 16); // tamanho do bloco \"fmt \"\n  cabecalho.writeUInt16LE(1, 20); // PCM\n  cabecalho.writeUInt16LE(1, 22); // mono\n  cabecalho.writeUInt32LE(taxa, 24);\n  cabecalho.writeUInt32LE(bytesPorSegundo, 28);\n  cabecalho.writeUInt16LE(2, 32); // bytes por amostra\n  cabecalho.writeUInt16LE(16, 34); // bits por amostra\n  cabecalho.write('data', 36);\n  cabecalho.writeUInt32LE(bytes.length, 40);\n  wav = Buffer.concat([cabecalho, bytes]);\n}\n\nreturn [\n  {\n    json: {\n      audioContent: wav.toString('base64'),\n      segundos: Math.max(1, Math.round(tamanhoAudio / bytesPorSegundo)),\n    },\n  },\n];\n" },
    onError: 'continueErrorOutput',
    position: [3080, 140],
  },
  output: [{ audioContent: 'UklGRg==', segundos: 90 }],
});

const audioArquivo = node({
  type: 'n8n-nodes-base.convertToFile',
  version: 1.1,
  config: {
    name: 'Áudio para arquivo',
    parameters: { operation: 'toBinary', sourceProperty: 'audioContent', options: { fileName: 'resumo-da-manha.wav', mimeType: 'audio/wav' } },
    position: [3300, 140],
  },
  output: [{}],
});

const enviarAudio = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Enviar áudio do resumo',
    parameters: {
      resource: 'message',
      operation: 'sendAudio',
      chatId: expr("{{ $('Configuração do resumo').first().json.chat_id }}"),
      binaryData: true,
      binaryPropertyName: 'data',
      additionalFields: {
        caption: '🎧 Resumo da manhã na voz da Kira',
        title: 'Resumo da manhã',
        performer: 'Kira',
        fileName: 'resumo-da-manha.wav',
        duration: expr("{{ $('Preparar áudio (WAV)').first().json.segundos }}"),
      },
    },
    credentials: { telegramApi: credTelegram },
    onError: 'continueRegularOutput',
    position: [3520, 140],
  },
  output: [{ ok: true, result: { message_id: 52, audio: { duration: 90 } } }],
});

const nota = sticky(
  '## ☀️ Resumo da manhã da Kira\n\n' +
    'Todo dia às **7h** (horário de Brasília): lê notícias de fontes confiáveis por RSS (inclusive mineração, petróleo, siderurgia e florestal), pega dólar, euro e bitcoin, pede ao Gemini um resumo curto por seção e manda no Telegram, em texto e em áudio na voz da Kira.\n\n' +
    '- **chat_id** e **nome_dono**: nó *Configuração do resumo*.\n' +
    '- **Fontes**: lista no nó *Fontes* (seção, nome e RSS).\n' +
    '- Se o Gemini falhar, vão só os títulos com link (nó *Resumo reserva*).\n\n' +
    'Tudo grátis: RSS, Google Notícias, Banco Central e Coinbase (cotações) e a chave gratuita do Gemini.',
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
  .to(textoParaVoz)
  .to(roteiroVoz)
  .to(vozResumo)
  .to(prepararAudio)
  .to(audioArquivo)
  .to(enviarAudio)
  .add(resumir.onError(reserva))
  .add(reserva)
  .to(montarMensagem)
  .add(enviar.onError(enviarSimples))
  .add(nota);
