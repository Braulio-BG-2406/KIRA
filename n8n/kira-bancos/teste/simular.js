// Simulação local: roda os nós Code com $, $input, DateTime e helpers.httpRequest simulados (Pluggy de mentira, sem rede).
const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');
const DIR = path.join(__dirname, '..');

function runCode(file, { input, nodes, httpRequest }) {
  const code = fs.readFileSync(path.join(DIR, file), 'utf8');
  const $ = (name) => ({ first: () => ({ json: nodes[name] }) });
  const $input = { all: () => input.map((json) => ({ json })), first: () => ({ json: input[0] }) };
  const fn = new Function('$', '$input', 'DateTime', `return (async function () {\n${code}\n}).call(this);`);
  return fn.call({ helpers: { httpRequest } }, $, $input, DateTime);
}

const hoje = DateTime.now().setZone('America/Sao_Paulo');
const d = (dias) => hoje.minus({ days: dias }).toFormat('yyyy-MM-dd') + 'T03:00:00.000Z';
const due = (dias) => hoje.plus({ days: dias }).toFormat('yyyy-MM-dd') + 'T00:00:00.000Z';

const ITEMS = {
  'item-nu': { id: 'item-nu', status: 'UPDATED', lastUpdatedAt: hoje.minus({ hours: 5 }).toUTC().toISO(), connector: { name: 'MeuPluggy' }, consentExpiresAt: due(10) },
  'item-inter': { id: 'item-inter', status: 'LOGIN_ERROR', lastUpdatedAt: hoje.minus({ days: 2 }).toUTC().toISO(), connector: { name: 'MeuPluggy' } },
};
const ACCOUNTS = {
  'item-nu': [
    { id: 'acc-nu-cc', itemId: 'item-nu', type: 'BANK', subtype: 'CHECKING_ACCOUNT', name: 'Conta', balance: 1520.37, currencyCode: 'BRL', bankData: { transferNumber: '0260/0001/1234567-8', automaticallyInvestedBalance: 1520.37 } },
    { id: 'acc-nu-cc2', itemId: 'item-nu', type: 'CREDIT', subtype: 'CREDIT_CARD', name: 'Nubank Ultravioleta', number: '5162********4321', balance: 2350.1, currencyCode: 'BRL', creditData: { balanceDueDate: due(5), minimumPayment: 352.5, creditLimit: 10000, availableCreditLimit: 7649.9 } },
  ],
  'item-inter': [
    { id: 'acc-inter-cc', itemId: 'item-inter', type: 'BANK', subtype: 'CHECKING_ACCOUNT', name: 'Conta Corrente', balance: -45.2, currencyCode: 'BRL', bankData: { transferNumber: '077/0001/99999-1' } },
    { id: 'acc-inter-black', itemId: 'item-inter', type: 'CREDIT', subtype: 'CREDIT_CARD', name: 'BLACK', number: '2613', balance: 500, currencyCode: 'BRL', creditData: { balanceDueDate: due(-15), minimumPayment: 99, creditLimit: 1000, availableCreditLimit: 500 } },
  ],
};
const TX = {
  'acc-nu-cc': [
    { id: 't1', description: 'Transferência recebida - SALARIO HIDRAU', amount: 8000, type: 'CREDIT', category: 'Salary', date: d(3) },
    { id: 't2', description: 'Pagamento de fatura', amount: -1800, type: 'DEBIT', category: 'Credit card payment', date: d(4) },
    { id: 't3', description: 'Pix enviado - Fulano', amount: -120, type: 'DEBIT', category: 'Third party transfer - PIX', date: d(6) },
    { id: 't4', description: 'Aplicação RDB', amount: -1000, type: 'DEBIT', category: 'Fixed income', date: d(7) },
    { id: 't9', description: 'Conta de luz CEMIG', amount: -230.55, type: 'DEBIT', category: 'Electricity', date: d(8) },
  ],
  'acc-nu-cc2': [
    { id: 't5', description: 'IFOOD *RESTAURANTE', amount: 85.9, type: 'DEBIT', category: 'Food delivery', date: d(1), merchant: { businessName: 'iFood' } },
    { id: 't6', description: 'Supermercado BH', amount: 412.33, type: 'DEBIT', category: 'Groceries', date: d(2), creditCardMetadata: { installmentNumber: 1, totalInstallments: 1 } },
    { id: 't7', description: 'Pagamento recebido', amount: -1800, type: 'CREDIT', category: 'Credit card payment', date: d(4) },
    { id: 't8', description: 'AMAZON', amount: 120, amountInAccountCurrency: 650.4, currencyCode: 'USD', type: 'DEBIT', category: 'Online shopping', date: d(5), creditCardMetadata: { installmentNumber: 2, totalInstallments: 10 }, status: 'PENDING' },
    { id: 't10', description: 'Estorno Loja X', amount: -50, type: 'CREDIT', category: 'Reversal', date: d(5) },
  ],
  'acc-inter-cc': [
    { id: 't11', description: 'Tarifa', amount: -45.2, type: 'DEBIT', category: 'Account fees', date: d(9) },
    { id: 't12', description: 'Débito Renda Fixa - Lig Liquidez', amount: -3000, type: 'DEBIT', category: 'Groceries', date: d(2) },
  ],
  'acc-inter-black': [
    { id: 't13', description: 'PAGAMENTO ON LINE', amount: -2279.11, type: 'CREDIT', category: 'Shopping', date: d(8) },
    { id: 't14', description: 'MERCADOLIVRE MERCADOL OSASCO BRA', amount: 19.9, type: 'DEBIT', category: 'Investments', date: d(3) },
    { id: 't15', description: 'ANTHROPIC SAN FRANCISCO CA', amount: 20, type: 'DEBIT', category: 'Transfers', date: d(2) },
  ],
};
const BILLS = { 'acc-nu-cc2': [{ id: 'b1', dueDate: due(-25), totalAmount: 1800, minimumPaymentAmount: 270 }, { id: 'b2', dueDate: due(-55), totalAmount: 2100 }] };
const INV = { 'item-nu': [{ id: 'i1', name: 'RDB Nubank', type: 'FIXED_INCOME', subtype: 'CDB', balance: 15000, status: 'ACTIVE', rate: 100, rateType: 'CDI' }, { id: 'i2', name: 'Fundo X', type: 'MUTUAL_FUND', balance: 5000.5 }], 'item-inter': [] };

const calls = [];
const r2 = (v) => Math.round(v * 100) / 100;
function mockHttp({ fail = {}, v1gone = false } = {}) {
  return async (opts) => {
    if (opts.method !== 'GET') throw new Error('método proibido ' + opts.method);
    if (opts.headers['X-API-KEY'] !== 'KEY') return { statusCode: 403, body: { message: 'forbidden' } };
    const u = new URL(opts.url);
    const p = u.pathname;
    const qs = { ...Object.fromEntries(u.searchParams), ...opts.qs };
    calls.push(p + ' ' + JSON.stringify(qs));
    const page = (arr) => ({ total: arr.length, totalPages: 1, page: 1, results: arr });
    if (fail[p]) return { statusCode: fail[p], body: { message: 'boom' } };
    let m;
    if ((m = p.match(/^\/items\/(.+)$/))) return ITEMS[m[1]] ? { statusCode: 200, body: ITEMS[m[1]] } : { statusCode: 404, body: { message: 'Item not found' } };
    if (p === '/accounts') return { statusCode: 200, body: page(ACCOUNTS[qs.itemId] || []) };
    if (p === '/transactions') {
      if (v1gone) return { statusCode: 404, body: { message: 'gone' } };
      const all = (TX[qs.accountId] || []).filter((t) => t.date.slice(0, 10) >= qs.from && t.date.slice(0, 10) <= qs.to);
      return { statusCode: 200, body: page(all) };
    }
    if (p === '/v2/transactions') {
      const all = TX[qs.accountId] || [];
      if (!qs.cursor) return { statusCode: 200, body: { results: all.slice(0, 2), next: '?cursor=abc&accountId=' + qs.accountId } };
      return { statusCode: 200, body: { results: all.slice(2), next: null } };
    }
    if (p === '/bills') return { statusCode: 200, body: page(BILLS[qs.accountId] || []) };
    if (p === '/investments') return { statusCode: 200, body: page(INV[qs.itemId] || []) };
    return { statusCode: 404, body: { message: 'unknown ' + p } };
  };
}

(async () => {
  const trig = (o) => ({ ambiente: 'PESSOAL', tipo: '', desde: '', ate: '', banco: '', busca: '', limite: 0, ...o });
  // Preparar: sem conexões
  console.log('--- preparar sem conexões');
  console.log(JSON.stringify(await runCode('preparar-consulta.js', { input: [{}], nodes: { 'Quando a Kira consultar os bancos': trig({}) } })));
  const conexoes = [{ item_id: 'item-nu', banco: '', ativo: true }, { item_id: 'item-inter', banco: 'Inter', ativo: true }, { item_id: 'x', ativo: false }];
  const casos = [
    trig({ tipo: 'resumo' }),
    trig({ tipo: 'Transações', busca: 'ifood' }),
    trig({ tipo: 'extrato', limite: 3 }),
    trig({ tipo: 'gastos' , desde: hoje.minus({ days: 40 }).toFormat('dd/MM/yyyy') }),
    trig({ tipo: 'faturas' }),
    trig({ tipo: 'investimentos', banco: 'nubank' }),
    trig({ tipo: 'conexoes' }),
    trig({ tipo: 'resumo', banco: 'itau' }),
    trig({ tipo: 'transacoes', busca: 'entradas', desde: '2099-01-01' }),
  ];
  for (const t of casos) {
    const prep = (await runCode('preparar-consulta.js', { input: conexoes, nodes: { 'Quando a Kira consultar os bancos': t } }))[0].json;
    console.log(`\n=== ${t.tipo} ${t.banco} ${t.busca} -> ${JSON.stringify({ ...prep, conexoes: prep.conexoes?.length })}`);
    const out = await runCode('consultar-bancos.js', { input: [{ apiKey: 'KEY' }], nodes: { 'Preparar consulta': prep }, httpRequest: mockHttp() });
    console.log(JSON.stringify(out[0].json, null, 1));
  }
  console.log('\n=== conferências');
  const conferir = (cond, msg) => { if (!cond) { console.error('FALHOU: ' + msg); process.exitCode = 1; } else console.log('ok: ' + msg); };
  const rodar = async (o) => (await runCode('consultar-bancos.js', { input: [{ apiKey: 'KEY' }], nodes: { 'Preparar consulta': (await runCode('preparar-consulta.js', { input: conexoes, nodes: { 'Quando a Kira consultar os bancos': trig(o) } }))[0].json }, httpRequest: mockHttp() }))[0].json;
  const resumo = await rodar({ tipo: 'resumo' });
  conferir(resumo.total_em_conta === r2(1520.37 - 45.2), 'saldo em conta sem contar o aplicado automaticamente de novo');
  const black = resumo.cartoes.find((c) => c.cartao.includes('2613'));
  conferir(black.vencimento_previsto === true && black.vence_em_dias >= 0 && black.pagamento_minimo === undefined, 'vencimento já passado vira o próximo (previsto), sem o mínimo da fatura fechada');
  const gastos = await rodar({ tipo: 'gastos', desde: hoje.minus({ days: 40 }).toFormat('yyyy-MM-dd') });
  conferir(!gastos.maiores_gastos.some((g) => /renda fixa/i.test(g.descricao)), 'aplicação em renda fixa não conta como gasto');
  conferir(gastos.maiores_gastos.some((g) => /mercadolivre/i.test(g.descricao) && g.categoria === 'Compras no cartão'), 'compra no cartão classificada como investimento conta como gasto');
  conferir(!gastos.por_categoria.some((c) => c.categoria === 'Transferências'), 'compra no cartão não aparece como transferência');
  conferir(gastos.estornos_no_cartao === 50, 'PAGAMENTO ON LINE no cartão é pagamento de fatura, não estorno');

  console.log('\n=== v2 fallback');
  const prep = (await runCode('preparar-consulta.js', { input: conexoes, nodes: { 'Quando a Kira consultar os bancos': trig({ tipo: 'transacoes', desde: '2000-01-01' }) } }))[0].json;
  const out = await runCode('consultar-bancos.js', { input: [{ apiKey: 'KEY' }], nodes: { 'Preparar consulta': prep }, httpRequest: mockHttp({ v1gone: true }) });
  console.log(out[0].json.total_encontrado, out[0].json.periodo, out[0].json.bancos_com_falha);
  console.log('\n=== chave errada');
  const out2 = await runCode('consultar-bancos.js', { input: [{ apiKey: 'BAD' }], nodes: { 'Preparar consulta': prep }, httpRequest: mockHttp() });
  console.log(JSON.stringify(out2[0].json));
  console.log('\n=== sem apiKey');
  console.log(JSON.stringify((await runCode('consultar-bancos.js', { input: [{}], nodes: { 'Preparar consulta': prep }, httpRequest: mockHttp() }))[0].json));
  console.log('\n=== falha');
  console.log(JSON.stringify((await runCode('explicar-falha.js', { input: [{ error: { message: '401 - {"message":"Invalid clientId or clientSecret"}' } }], nodes: {} }))[0].json));
  console.log(JSON.stringify((await runCode('explicar-falha.js', { input: [{ error: { message: 'ETIMEDOUT' } }], nodes: {} }))[0].json));
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
