import { workflow, node, trigger, ifElse, newCredential, expr } from '@n8n/workflow-sdk';

const gatilho = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: {
    name: 'Quando a Kira consultar o MarketUP',
    parameters: {
      workflowInputs: {
        values: [{ name: 'ambiente' }, { name: 'acao' }, { name: 'busca' }, { name: 'id', type: 'number' }, { name: 'limite', type: 'number' }],
      },
    },
  },
});

const soNegocios = ifElse({
  version: 2.3,
  config: {
    name: 'Só no modo Negócios',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          {
            id: 'cond-ambiente',
            leftValue: expr("{{ String($json.ambiente ?? '').trim().toUpperCase() }}"),
            rightValue: 'NEGOCIOS',
            operator: { type: 'string', operation: 'equals' },
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
  },
});

const ehGuia = ifElse({
  version: 2.3,
  config: {
    name: 'É o passo a passo?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [
          {
            id: 'cond-guia',
            leftValue: expr("{{ /publica|cadastr|como_/.test(String($json.acao ?? '').toLowerCase()) }}"),
            rightValue: '',
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
  },
});

const fora = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Fora do modo Negócios',
    parameters: {
      assignments: {
        assignments: [
          { id: 'fora-ok', name: 'ok', value: false, type: 'boolean' },
          { id: 'fora-erro', name: 'erro', value: 'O MarketUP da Infinite só pode ser consultado no modo Negócios.', type: 'string' },
          {
            id: 'fora-orientacao',
            name: 'orientacao',
            value: 'Diga ao dono, em uma frase, que esses dados são do ambiente Negócios e que ele pode trocar dizendo "modo negócios". Não use nem invente dados do MarketUP aqui.',
            type: 'string',
          },
        ],
      },
      options: {},
    },
  },
});

const guia = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Passo a passo para publicar',
    parameters: {
      jsCode: `// Caminho para publicar um produto novo da Infinite: cadastro no MarketUP e envio para a Loja Integrada
// (a integração de loja virtual ativa nesta conta do MarketUP). Não acessa o sistema: só ensina.
return [
  {
    json: {
      ok: true,
      fonte: 'MarketUP da Infinite (infinitejs.marketup.com) com a integração da Loja Integrada',
      acao: 'como_publicar',
      passos: [
        'Entre em infinitejs.marketup.com com o e-mail e a senha do MarketUP.',
        'Abra o menu Catálogo > Produtos e clique em Adicionar novo.',
        'Código de barras: digite o da peça e clique em Localizar item. Se a peça não tiver, use a opção da tela para cadastrar sem código (o sistema gera um código próprio).',
        'Preencha os campos obrigatórios (em cinza escuro): Descrição (o nome da peça), Tipo de item, Unidade (ex.: UN), Custo e Venda.',
        'Classifique a peça: Categoria, Subcategoria e Marca. Se ainda não existirem, crie antes em Catálogo > Categorias e Catálogo > Marcas. Peça com variação usa Cor e Tamanho.',
        'Estoque: informe a quantidade inicial e o local de estoque.',
        'Fotos: adicione as fotos da peça (boa luz e fundo limpo; a primeira vira a capa).',
        'Aba Loja Virtual do produto: marque para vender na loja virtual e preencha o nome na loja, a descrição, a garantia, os itens inclusos, as especificações, o peso e as medidas (altura, largura e comprimento), que o frete usa.',
        'Clique em Salvar e espere a mensagem de dados inseridos com sucesso.',
        'Envie para a Loja Integrada: menu Integrações > Loja Integrada, na lista de produtos, vincule ou envie o produto novo (sincronizar do MarketUP).',
        'Confira na Loja Integrada se o produto apareceu com nome, preço, estoque e fotos. Se faltar algo, ajuste no MarketUP e sincronize de novo.',
      ],
      conferir_antes: [
        'Preço de venda conferido com a precificação (consultar_infinite, tipo simular_preco).',
        'Pelo menos uma foto boa da peça.',
        'Peso e medidas preenchidos (sem isso o frete não calcula).',
        'Estoque maior que zero.',
        'Categoria certa (é o que organiza a loja).',
      ],
      depois: 'A Kira confere o cadastro com consultar_marketup (acao produto e o nome da peça) e mostra se ficou algo faltando.',
      links: { produtos: 'https://infinitejs.marketup.com/index.html#/item', pedidos: 'https://infinitejs.marketup.com/index.html#/sale_order' },
      orientacao:
        'Ensine o caminho ao dono em passos curtos e na ordem, adaptando ao que ele perguntou (se ele quiser só uma parte, mostre só ela). Os nomes dos menus podem variar um pouco: se ele disser que não achou um botão, peça um print da tela. A Kira ainda não cadastra nem publica produtos sozinha: ela ensina e confere depois.',
    },
  },
];
`,
    },
  },
});

const prepararLogin = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Preparar login',
    parameters: {
      jsCode: `// Cabeçalhos que a tela de login da empresa (infinitejs.marketup.com) manda: o token público de visitante e o domínio da conta.
return [
  {
    json: {
      visitante: 'eyJBdXRoU2Vzc2lvbklEIjoiNEQ1RjgxQkYtREU4My00MzdDLUIyN0UtQ0QwNjVEQzJBRTY5In0=',
      dominio: Buffer.from('infinitejs:2522208').toString('base64'),
    },
  },
];
`,
    },
  },
});

const entrar = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Entrar no MarketUP',
    onError: 'continueRegularOutput',
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

const lerAcesso = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Ler acesso',
    parameters: {
      jsCode: `// Tira o acesso da resposta do login (o Item pode vir em base64) e passa adiante só o token e a conta.
const resposta = $input.first().json;
if (resposta.error) {
  // O erro pode vir como texto ou como objeto (message/description), conforme a falha.
  const erro = resposta.error;
  const mensagem = typeof erro === 'string' ? erro : String(erro.message || erro.name || JSON.stringify(erro));
  const descricao = typeof erro === 'string' ? '' : String(erro.description || '');
  if (/senha inv/i.test(mensagem + ' ' + descricao)) return [{ json: { error: { message: 'Usuário ou senha inválidos no MarketUP' } } }];
  return [{ json: { error: { message: mensagem.slice(0, 300) || 'erro no login', description: descricao.slice(0, 300) } } }];
}

const abrir = (valor) => {
  if (typeof valor !== 'string' || valor.length < 20 || !/^[A-Za-z0-9+/=]+$/.test(valor)) return valor;
  try {
    let texto = Buffer.from(valor, 'base64').toString('utf8');
    if (texto[0] === '%') texto = decodeURIComponent(texto);
    if (texto[0] !== '{' && texto[0] !== '[') return valor;
    return JSON.parse(texto);
  } catch (erro) {
    return valor;
  }
};
const achar = (valor, regra, profundidade = 0) => {
  if (!valor || typeof valor !== 'object' || profundidade > 5) return null;
  for (const [chave, v] of Object.entries(valor)) {
    if (regra.test(chave) && (typeof v === 'string' || typeof v === 'number') && v !== '') return v;
  }
  for (const v of Object.values(valor)) {
    const achado = achar(abrir(v), regra, profundidade + 1);
    if (achado) return achado;
  }
  return null;
};

const item = abrir(resposta.Item) ?? resposta;
let token = achar(item, /^(AuthToken|Token)$/i) || achar(resposta, /^(AuthToken|Token)$/i);
// Sem token pronto, monta igual ao do site: base64 de {"AuthSessionID": "..."}.
if (!token) {
  const sessao = achar(item, /^AuthSessionID$/i);
  if (sessao) token = Buffer.from(JSON.stringify({ AuthSessionID: sessao })).toString('base64');
}
if (!token) {
  const campos = item && typeof item === 'object' ? Object.keys(item).join(', ') : typeof item;
  return [{ json: { error: { message: String(resposta.message || 'o MarketUP não devolveu o acesso').slice(0, 300), description: 'campos recebidos: ' + campos } } }];
}
return [{ json: { AuthToken: String(token), InstallID: Number(achar(item, /^InstallID$/i)) || 2522208 } }];
`,
    },
  },
});

const consultar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Consultar MarketUP',
    parameters: {
      jsCode: `// Usa o acesso de "Entrar no MarketUP" e lê a API do MarketUP da Infinite (a mesma que o site usa). Só leitura.
const entrada = $('Quando a Kira consultar o MarketUP').first().json;
const login = $input.first().json;
const acao = String(entrada.acao || 'verificar').trim().toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/ +/g, '_');
const busca = String(entrada.busca ?? '').trim();
const limite = Math.min(Math.max(Math.round(Number(entrada.limite) || 10), 1), 30);
const idPedido = Math.round(Number(entrada.id) || 0);
const API = 'https://api-erp.marketup.com';
const DOMINIO = 'infinitejs';
const PAINEL = 'https://infinitejs.marketup.com/index.html#/';
const FONTE = 'MarketUP da Infinite (infinitejs.marketup.com)';
const VISITANTE = 'eyJBdXRoU2Vzc2lvbklEIjoiNEQ1RjgxQkYtREU4My00MzdDLUIyN0UtQ0QwNjVEQzJBRTY5In0=';
const agora = DateTime.now().setZone('America/Sao_Paulo').toFormat("dd/MM/yyyy 'às' HH'h'mm");
const helpers = this.helpers;

// Junta as mensagens de erro (do login ou da API) num texto curto.
const textosDe = (valor, profundidade = 0, textos = []) => {
  if (!valor || profundidade > 4) return textos;
  if (typeof valor === 'string') {
    textos.push(valor);
    return textos;
  }
  if (typeof valor === 'object') {
    for (const chave of ['message', 'Message', 'errorMessage', 'ErrorMessage', 'description']) {
      if (typeof valor[chave] === 'string') textos.push(valor[chave]);
    }
    textosDe(valor.error, profundidade + 1, textos);
    textosDe(valor.body, profundidade + 1, textos);
  }
  return textos;
};
const juntar = (textos) => [...new Set(textos.map((t) => String(t).trim()).filter(Boolean))].join(' — ').slice(0, 500);

// Procura um campo pelo nome em qualquer nível da resposta (o token vem como AuthToken, igual ao cookie do site).
const acharCampo = (valor, regra, profundidade = 0) => {
  if (!valor || typeof valor !== 'object' || profundidade > 5) return null;
  for (const [chave, v] of Object.entries(valor)) {
    if (regra.test(chave) && (typeof v === 'string' || typeof v === 'number') && v !== '') return v;
  }
  for (const v of Object.values(valor)) {
    const achado = acharCampo(v, regra, profundidade + 1);
    if (achado) return achado;
  }
  return null;
};

const token = login.error ? null : acharCampo(login, /^AuthToken$/i);
if (!token) {
  const erro = juntar(textosDe(login.error ?? login)) || 'o MarketUP não devolveu o acesso';
  const semCredencial = /credential|credencia/i.test(erro);
  return [
    {
      json: {
        ok: false,
        fonte: FONTE,
        erro,
        orientacao: semCredencial
          ? 'A Kira ainda não tem o login do MarketUP. Explique ao dono, em poucas palavras, que ele precisa criar no n8n a credencial "MarketUP (Infinite)" (tipo Custom Auth) com o e-mail e a senha do MarketUP e escolher essa credencial no passo "Entrar no MarketUP" do workflow "Kira — MarketUP da Infinite (ferramenta)". Nunca peça a senha pelo Telegram. O passo a passo para publicar produtos (acao como_publicar) funciona mesmo sem o login.'
          : 'O MarketUP não aceitou o login da Kira. Explique o erro ao dono em poucas palavras (se a senha mudou, ele atualiza a credencial "MarketUP (Infinite)" no n8n). Não invente dados.',
      },
    },
  ];
}

const installId = acharCampo(login, /^InstallID$/i) || 2522208;
const cabecalhos = (comToken) => ({
  'Content-Type': 'application/json',
  Authorization: 'Bearer ' + (comToken ? token : VISITANTE),
  'x-auth-token': Buffer.from(DOMINIO + ':' + installId).toString('base64'),
});

// Algumas respostas vêm em base64 (o site usa btoa(encodeURI(JSON))).
const abrir = (valor) => {
  if (typeof valor !== 'string' || valor.length < 20 || !/^[A-Za-z0-9+/=]+$/.test(valor)) return valor;
  try {
    let texto = Buffer.from(valor, 'base64').toString('utf8');
    if (texto[0] === '%') texto = decodeURIComponent(texto);
    if (texto[0] !== '{' && texto[0] !== '[') return valor;
    return JSON.parse(texto);
  } catch (erro) {
    return valor;
  }
};

// Nomes das situações do pedido, iguais aos da tela do MarketUP.
const SITUACAO = { 1: 'Novo', 2: 'Faturado', 3: 'Entrega parcial', 4: 'Não conformidade', 5: 'Atrasado', 6: 'Finalizado', 7: 'Cancelado', 8: 'NF-e solicitada', 9: 'Aguardando pagamento', 10: 'Pago', 11: 'Consignado', 12: 'Enviado' };
const ENTREGA = { 1: 'Pendente', 2: 'Entregue', 3: 'Entrega parcial', 4: 'Atrasado', 5: 'Devolução parcial', 6: 'Devolvido', 7: 'Cancelado' };
const FINANCEIRO = { 1: 'Pendente', 2: 'Pago' };
const traduzir = (item) => {
  if (!item || typeof item !== 'object' || !('SaleOrderID' in item)) return item;
  const t = { ...item };
  if (SITUACAO[t.Status]) t.Situacao = SITUACAO[t.Status];
  if (ENTREGA[t.DeliveryStatus]) t.SituacaoEntrega = ENTREGA[t.DeliveryStatus];
  if (FINANCEIRO[t.FinancialStatus]) t.SituacaoFinanceira = FINANCEIRO[t.FinancialStatus];
  if (t.Client && typeof t.Client === 'object') t.Cliente = t.Client.OfficialName || t.Client.Name;
  if (t.Seller && typeof t.Seller === 'object') t.Vendedor = t.Seller.OfficialName || t.Seller.Name;
  delete t.Status;
  delete t.DeliveryStatus;
  delete t.FinancialStatus;
  return t;
};

const chamar = async (caminho, corpo = {}, comToken = true) => {
  const resposta = await helpers.httpRequest({
    method: 'POST',
    url: API + caminho,
    headers: cabecalhos(comToken),
    body: { ...corpo, SendDate: new Date().toISOString() },
    json: true,
    returnFullResponse: true,
    ignoreHttpStatusErrors: true,
    timeout: 60000,
  });
  let corpoResposta = resposta.body;
  if (typeof corpoResposta === 'string') {
    try {
      corpoResposta = JSON.parse(corpoResposta);
    } catch (erro) {}
  }
  // O próprio site trata 404 numa lista como "nenhum resultado".
  if (resposta.statusCode === 404) return { Items: [], TotalItems: 0, nao_encontrado: true };
  if (resposta.statusCode >= 400) {
    throw new Error('o MarketUP respondeu ' + resposta.statusCode + ' em ' + caminho + ': ' + (juntar(textosDe(corpoResposta)) || 'sem detalhe'));
  }
  if (corpoResposta && typeof corpoResposta === 'object') {
    corpoResposta.Item = abrir(corpoResposta.Item);
    corpoResposta.Items = abrir(corpoResposta.Items);
  }
  return corpoResposta;
};

// Deixa a resposta enxuta para a Kira: sem campos vazios, sem imagens em base64 e sem chaves ou senhas.
const OCULTAR = /password|senha|token|apikey|api_key|appkey|secret|base64|bytearray|imagedata|html$/i;
const MANTER_FALSO = /ecommerce|marketplace|publi|active|ativo|cancel|b2c|sync/i;
const compactar = (valor, profundidade = 0, chave = '') => {
  if (valor === null || valor === undefined || valor === '') return undefined;
  if (typeof valor === 'string') {
    const texto = valor.replace(/<[^>]+>/g, ' ').replace(/[ \\t\\r\\n]+/g, ' ').trim();
    if (!texto || texto.startsWith('0001-01-01')) return undefined;
    return texto.length > 300 ? texto.slice(0, 300) + '…' : texto;
  }
  if (valor === false) return MANTER_FALSO.test(chave) ? false : undefined;
  if (typeof valor !== 'object') return valor;
  if (profundidade > 3) return undefined;
  if (Array.isArray(valor)) {
    const lista = valor.slice(0, 20).map((v) => compactar(v, profundidade + 1, chave)).filter((v) => v !== undefined);
    return lista.length ? lista : undefined;
  }
  const saida = {};
  for (const [k, v] of Object.entries(valor)) {
    if (OCULTAR.test(k)) continue;
    const c = compactar(v, profundidade + 1, k);
    if (c === undefined) continue;
    if (typeof c === 'object' && !Array.isArray(c) && !Object.keys(c).length) continue;
    saida[k] = c;
  }
  return Object.keys(saida).length ? saida : undefined;
};

// Nas listas, só os campos que importam (nome, código, preço, estoque, cliente, valores, datas, situação...).
const CAMPOS_LISTA = /ID$|Code|Number|Name|Description|BarCode|Reference|Price|Value|Cost|Stock|Amount|Quantity|Category|Brand|Unit|Ecommerce|Marketplace|Publi|Active|Date|Status|Situation|Situacao|Cliente|Vendedor|Client|Customer|Person|Seller|Total|Discount|Payment|Delivery|Tracking|Invoice|Cancel|B2c|Sync/i;
const ZERO_SEM_SENTIDO = /ID$|Discount|Percent|Subtotal|Shipping|Taxes|Exchange|ItemsToDelivery|Balance|Rescue/;
const resumir = (item) => {
  const c = compactar(traduzir(item)) || {};
  const r = {};
  for (const [k, v] of Object.entries(c)) {
    if (!CAMPOS_LISTA.test(k)) continue;
    if (Array.isArray(v)) continue;
    if (v === 0 && ZERO_SEM_SENTIDO.test(k)) continue;
    if (v && typeof v === 'object') {
      const nome = v.OfficialName ?? v.Name ?? v.FullName ?? v.CompanyName ?? v.Description;
      if (nome !== undefined) r[k] = nome;
      continue;
    }
    r[k] = v;
  }
  return Object.keys(r).length ? r : c;
};

// Corta a resposta para caber na conversa.
const caber = (saida) => {
  let texto = JSON.stringify(saida);
  while (texto.length > 14000 && Array.isArray(saida.itens) && saida.itens.length > 1) {
    saida.itens.pop();
    saida.cortado = 'mostrando só os ' + saida.itens.length + ' primeiros';
    texto = JSON.stringify(saida);
  }
  if (texto.length > 14000 && saida.detalhes) {
    const enxuto = {};
    for (const [k, v] of Object.entries(saida.detalhes)) {
      if (Array.isArray(v)) enxuto[k] = v.slice(0, 5);
      else if (!v || typeof v !== 'object') enxuto[k] = v;
    }
    saida.detalhes = enxuto;
    saida.cortado = 'detalhes resumidos';
  }
  return [{ json: saida }];
};

const listar = async (caminho, tamanho = limite, termo = busca) => {
  const resposta = await chamar(caminho, { Page: 1, PageSize: tamanho, SearchTerm: termo });
  const itens = Array.isArray(resposta && resposta.Items) ? resposta.Items : [];
  return { total: Number((resposta && resposta.TotalItems) ?? itens.length) || 0, itens };
};

const detalhar = async (caminhoLista, caminhoGet, campoId, nomeCoisa) => {
  let id = idPedido;
  let outros;
  if (!id) {
    if (!busca) return { erro: 'Diga qual ' + nomeCoisa + ': passe o id ou uma busca (número, nome ou código).' };
    const achados = await listar(caminhoLista, 5);
    if (!achados.itens.length) return { erro: 'Não achei ' + nomeCoisa + ' com "' + busca + '" no MarketUP.' };
    id = Number(acharCampo(achados.itens[0], new RegExp('^' + campoId + '$', 'i'))) || 0;
    if (!id) return { erro: 'Achei resultados, mas sem o código interno (' + campoId + ').', parecidos: achados.itens.map(resumir) };
    if (achados.itens.length > 1) outros = achados.itens.slice(1).map(resumir);
  }
  const resposta = await chamar(caminhoGet, { ID: id });
  if (!resposta || resposta.nao_encontrado || !resposta.Item) return { erro: 'Não achei ' + nomeCoisa + ' com o código ' + id + ' no MarketUP.' };
  // No produto, o que a publicação precisa (os nomes dos campos são os do próprio MarketUP).
  const item = resposta.Item;
  const tem = (k) => item && typeof item === 'object' && Object.prototype.hasOwnProperty.call(item, k);
  const checagem = {};
  if (tem('ItemImageList')) checagem.fotos = (item.ItemImageList || []).length;
  if (tem('InEcommerce')) checagem.na_loja_virtual = Boolean(item.InEcommerce);
  const medidas = ['GrossWeith', 'Heigth', 'Width', 'Length'].filter(tem);
  if (medidas.length) checagem.peso_e_medidas = medidas.every((k) => Number(item[k]) > 0) ? 'preenchidos' : 'faltando';
  return { id, detalhes: compactar(traduzir(item)), checagem_publicacao: Object.keys(checagem).length ? checagem : undefined, outros_parecidos: outros };
};

const base = { ok: true, fonte: FONTE, consultado_em: agora, acao };
const lembrete = 'Cite a fonte e a hora da consulta. Valores em R$. Use só o que veio aqui e nunca invente pedidos, preços, estoques ou status. A Kira só lê o MarketUP: não cria, não altera e não apaga nada.';

try {
  if (acao === 'verificar' || acao === 'status' || acao === 'site') {
    let site;
    try {
      const pagina = await helpers.httpRequest({ url: 'https://infinitejs.marketup.com/index.html', returnFullResponse: true, ignoreHttpStatusErrors: true, timeout: 30000, encoding: 'text' });
      site = pagina.statusCode;
    } catch (erro) {
      site = 'erro: ' + String(erro.message || erro).slice(0, 120);
    }
    const contar = async (caminho) => {
      try {
        return (await listar(caminho, 1, '')).total;
      } catch (erro) {
        return 'não consegui contar (' + String(erro.message || erro).slice(0, 160) + ')';
      }
    };
    let ultimos;
    try {
      ultimos = (await listar('/v1/SaleOrder/GetPagedList', 3, '')).itens.map(resumir);
    } catch (erro) {
      ultimos = 'não consegui ler (' + String(erro.message || erro).slice(0, 160) + ')';
    }
    let lojaIntegrada = 'não consegui conferir';
    try {
      const conta = abrir((await chamar('/v1/InstallSummaryInfo/Get', { Domain: DOMINIO }, false)).Item);
      const integracao = ((conta && conta.B2cConfigurationList) || []).find((c) => Number(c.B2cPlatformID) === 3);
      lojaIntegrada = integracao ? (integracao.IsActive ? 'ativa' : 'cadastrada, mas desativada') : 'não configurada';
    } catch (erro) {}
    return caber({
      ...base,
      site: site === 200 ? 'no ar' : 'com problema (' + site + ')',
      login: 'ok',
      produtos_cadastrados: await contar('/v1/CatalogItem/GetPagedList'),
      ultimos_pedidos: ultimos,
      integracao_loja_integrada: lojaIntegrada,
      links: { produtos: PAINEL + 'item', pedidos: PAINEL + 'sale_order' },
      orientacao: 'Conte ao dono, em poucas linhas, o que está ok e o que não está no MarketUP. ' + lembrete,
    });
  }

  if (acao === 'pedidos' || acao === 'produtos' || acao === 'loja_integrada') {
    const caminho = { pedidos: '/v1/SaleOrder/GetPagedList', produtos: '/v1/CatalogItem/GetPagedList', loja_integrada: '/v1/B2cIntegration/ItemList' }[acao];
    const resultado =
      acao === 'loja_integrada'
        ? await chamar(caminho, { B2cPlatformID: 3, Page: 1, PageSize: limite, SearchTerm: busca })
        : await listar(caminho);
    const itens = Array.isArray(resultado.itens) ? resultado.itens : Array.isArray(resultado.Items) ? resultado.Items : [];
    return caber({
      ...base,
      busca: busca || '(mais recentes)',
      total: Math.max(Number(resultado.total ?? resultado.TotalItems) || 0, itens.length),
      itens: itens.slice(0, limite).map(resumir),
      link: PAINEL + (acao === 'pedidos' ? 'sale_order' : 'item'),
      orientacao: (itens.length ? 'Resuma o que achou, sem copiar campos técnicos. ' : 'Não veio nenhum resultado: diga isso e sugira outra busca. ') + lembrete,
    });
  }

  if (acao === 'pedido' || acao === 'produto') {
    const r =
      acao === 'pedido'
        ? await detalhar('/v1/SaleOrder/GetPagedList', '/v1/SaleOrder/Get', 'SaleOrderID', 'pedido')
        : await detalhar('/v1/CatalogItem/GetPagedList', '/v1/CatalogItem/Get', 'ItemID', 'produto');
    if (r.erro) return caber({ ...base, ok: false, erro: r.erro, parecidos: r.parecidos, orientacao: 'Explique em uma frase e peça um dado melhor para buscar. ' + lembrete });
    return caber({
      ...base,
      id: r.id,
      detalhes: r.detalhes,
      checagem_publicacao: r.checagem_publicacao,
      outros_parecidos: r.outros_parecidos,
      orientacao:
        (acao === 'produto'
          ? 'Mostre o essencial do cadastro (nome, código, preço de venda, custo, estoque, categoria, fotos e se está na loja virtual). Se ele está publicando a peça, aponte o que falta conforme o passo a passo (fotos, peso e medidas, estoque, categoria, loja virtual). '
          : 'Mostre o essencial do pedido (número, data, cliente, itens, total, pagamento, entrega e situação). ') + lembrete,
    });
  }

  return caber({
    ...base,
    ok: false,
    erro: 'Ação desconhecida: ' + acao,
    orientacao: 'Use uma destas ações: verificar, pedidos, pedido, produtos, produto, loja_integrada ou como_publicar.',
  });
} catch (erro) {
  return caber({
    ...base,
    ok: false,
    erro: String(erro.message || erro).slice(0, 500),
    orientacao: 'Não consegui ler o MarketUP agora. Explique o erro ao dono em poucas palavras e não invente dados.',
  });
}
`,
    },
  },
});

export default workflow('kira-marketup', 'Kira — MarketUP da Infinite (ferramenta)')
  .add(gatilho)
  .to(soNegocios.onTrue(ehGuia.onTrue(guia).onFalse(prepararLogin.to(entrar).to(lerAcesso).to(consultar))).onFalse(fora));
