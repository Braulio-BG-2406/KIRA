// Lê os dados dos bancos pela API da Pluggy (Open Finance Brasil, via Meu Pluggy). SÓ LEITURA: aqui só há
// GETs; nenhuma chamada move dinheiro. A chave (apiKey) vem do passo "Entrar na Pluggy" e vale 2 horas.
// Nada é guardado: os dados são lidos na hora e vão só para a resposta da Kira.
const API = 'https://api.pluggy.ai';
const fuso = 'America/Sao_Paulo';
const pedido = $('Preparar consulta').first().json;
const apiKey = $input.first().json.apiKey;
const http = this.helpers;

if (!apiKey) {
  return [{
    json: {
      ok: false,
      erro: 'A Pluggy não devolveu a chave de acesso.',
      orientacao: 'Diga ao dono que a conexão com a Pluggy falhou agora e sugira tentar de novo em alguns minutos. Não invente números.',
    },
  }];
}

// --- acesso à API -------------------------------------------------------------------------------------
const pedir = async (caminho, qs = {}) => {
  const limpo = Object.fromEntries(Object.entries(qs).filter(([, v]) => v !== undefined && v !== null && v !== ''));
  const r = await http.httpRequest({
    method: 'GET',
    url: API + caminho,
    qs: limpo,
    json: true,
    timeout: 30000,
    headers: { 'X-API-KEY': apiKey, Accept: 'application/json' },
    returnFullResponse: true,
    ignoreHttpStatusErrors: true,
  });
  if (r.statusCode >= 400) {
    const corpo = typeof r.body === 'string' ? r.body : JSON.stringify(r.body ?? '');
    const e = new Error(`HTTP ${r.statusCode} em ${caminho.split('?')[0]}: ${corpo.slice(0, 300)}`);
    e.status = r.statusCode;
    throw e;
  }
  return r.body;
};
// Contas, faturas, investimentos e transações vêm em páginas (page/totalPages).
const paginado = async (caminho, qs) => {
  const tudo = [];
  for (let pagina = 1; pagina <= 20; pagina += 1) {
    const r = await pedir(caminho, { ...qs, page: pagina, pageSize: 500 });
    tudo.push(...(r?.results ?? []));
    if (pagina >= (Number(r?.totalPages) || 1)) break;
  }
  return tudo;
};
const transacoesDaConta = async (contaId) => {
  try {
    return await paginado('/transactions', { accountId: contaId, from: pedido.desde, to: pedido.ate });
  } catch (e) {
    if (![400, 404, 410].includes(e.status)) throw e;
    // Versão nova da API, paginada por cursor ("next" já vem pronto para concatenar).
    const tudo = [];
    let r = await pedir('/v2/transactions', { accountId: contaId, dateFrom: pedido.desde, dateTo: pedido.ate });
    for (let i = 0; i < 40; i += 1) {
      tudo.push(...(r?.results ?? []));
      if (!r?.next) break;
      r = await pedir('/v2/transactions' + r.next);
    }
    return tudo;
  }
};

// --- utilidades ---------------------------------------------------------------------------------------
const semAcento = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const temValor = (v) => v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v));
// Datas só de dia (vencimento, fechamento) vêm à meia-noite UTC: valem pelo próprio dia. As outras vão para Brasília.
const dia = (iso) => {
  const t = String(iso ?? '');
  if (!t) return undefined;
  if (!t.includes('T') || /T00:00:00(\.0+)?Z$/.test(t)) return DateTime.fromISO(t.slice(0, 10)).toFormat('dd/MM/yyyy');
  const d = DateTime.fromISO(t, { zone: 'utc' }).setZone(fuso);
  return d.isValid ? d.toFormat('dd/MM/yyyy') : undefined;
};
const diaIso = (iso) => {
  const t = String(iso ?? '');
  if (!t) return '';
  if (!t.includes('T') || /T00:00:00(\.0+)?Z$/.test(t)) return t.slice(0, 10);
  return DateTime.fromISO(t, { zone: 'utc' }).setZone(fuso).toFormat('yyyy-MM-dd');
};
const quando = (iso) => {
  const d = DateTime.fromISO(String(iso ?? ''), { zone: 'utc' });
  return d.isValid ? d.setZone(fuso).toFormat("dd/MM/yyyy 'às' HH:mm") : undefined;
};
const hoje = DateTime.now().setZone(fuso).startOf('day');
const diasAte = (iso) => {
  const t = diaIso(iso);
  if (!t) return undefined;
  return Math.round(DateTime.fromISO(t, { zone: fuso }).diff(hoje, 'days').days);
};
const final4 = (numero) => {
  const d = String(numero ?? '').replace(/\D/g, '');
  return d ? d.slice(-4) : undefined;
};
const semVazios = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));

// Pelo Meu Pluggy o conector é sempre "MeuPluggy": o banco sai do código COMPE da conta corrente.
const BANCOS_COMPE = {
  '001': 'Banco do Brasil', '033': 'Santander', '077': 'Inter', '104': 'Caixa', '208': 'BTG Pactual',
  '237': 'Bradesco', '260': 'Nubank', '290': 'PagBank', '323': 'Mercado Pago', '336': 'C6 Bank',
  '341': 'Itaú', '380': 'PicPay', '756': 'Sicoob', '748': 'Sicredi',
};
const deduzirBanco = (contas) => {
  for (const c of contas.filter((x) => x.type === 'BANK')) {
    const compe = String(c.bankData?.transferNumber ?? '').split('/')[0].replace(/\D/g, '').padStart(3, '0');
    if (BANCOS_COMPE[compe]) return BANCOS_COMPE[compe];
  }
  const nomes = contas.map((c) => semAcento(`${c.marketingName ?? ''} ${c.name ?? ''}`)).join(' ');
  const pistas = [['nubank', 'Nubank'], ['inter', 'Inter'], ['bradesco', 'Bradesco'], ['banco do brasil', 'Banco do Brasil'], ['ourocard', 'Banco do Brasil']];
  return pistas.find(([p]) => nomes.includes(p))?.[1];
};

const STATUS_ITEM = {
  UPDATED: 'atualizado',
  UPDATING: 'atualizando agora',
  OUTDATED: 'desatualizado (a última atualização falhou)',
  LOGIN_ERROR: 'erro de acesso (refazer a conexão no Meu Pluggy)',
  WAITING_USER_INPUT: 'esperando uma ação do dono no Meu Pluggy',
};

// Categorias da Pluggy (em inglês) -> português. As que não estão aqui passam como vieram.
const CATEGORIAS = {
  'income': 'Receitas', 'salary': 'Salário', 'retirement': 'Aposentadoria', 'entrepreneurial activities': 'Atividade empresarial',
  'government aid': 'Auxílio do governo', 'non-recurring income': 'Receita eventual', 'loans and financing': 'Empréstimos e financiamentos',
  'late payment and overdraft costs': 'Juros de atraso e cheque especial', 'interests charged': 'Juros cobrados', 'financing': 'Financiamento',
  'real estate financing': 'Financiamento imobiliário', 'vehicle financing': 'Financiamento de veículo', 'loans': 'Empréstimos',
  'investments': 'Investimentos', 'automatic investment': 'Aplicação automática', 'fixed income': 'Renda fixa', 'mutual funds': 'Fundos',
  'variable income': 'Renda variável', 'proceeds interests and dividends': 'Rendimentos e dividendos', 'pension': 'Previdência',
  'same person transfer': 'Transferência entre contas próprias', 'transfers': 'Transferências', 'transfer - pix': 'Pix',
  'transfer - ted': 'TED', 'transfer - doc': 'DOC', 'transfer - bank slip': 'Boleto', 'transfer - cash': 'Dinheiro',
  'transfer - internal': 'Transferência interna', 'third party transfer - pix': 'Pix para terceiros', 'credit card payment': 'Pagamento de fatura',
  'reversal': 'Estorno', 'legal obligations': 'Obrigações legais', 'alimony': 'Pensão alimentícia', 'services': 'Serviços',
  'telecommunications': 'Telecomunicações', 'internet': 'Internet', 'mobile': 'Celular', 'tv': 'TV', 'education': 'Educação',
  'online courses': 'Cursos online', 'university': 'Faculdade', 'school': 'Escola', 'wellness and fitness': 'Bem-estar e academia',
  'gyms and fitness centers': 'Academia', 'tickets': 'Ingressos', 'shopping': 'Compras', 'online shopping': 'Compras online',
  'electronics': 'Eletrônicos', 'pet supplies and vet': 'Pet e veterinário', 'clothing': 'Roupas', 'bookstore': 'Livraria',
  'digital services': 'Serviços digitais', 'video streaming': 'Streaming de vídeo', 'music streaming': 'Streaming de música',
  'gaming': 'Jogos', 'groceries': 'Mercado', 'food and drinks': 'Alimentação', 'eating out': 'Restaurantes',
  'food delivery': 'Delivery de comida', 'travel': 'Viagens', 'airport and airlines': 'Passagens aéreas', 'accommodation': 'Hospedagem',
  'donations': 'Doações', 'gambling': 'Apostas', 'lottery': 'Loteria', 'online bet': 'Apostas online', 'taxes': 'Impostos',
  'income taxes': 'Imposto de renda', 'tax on financial operations': 'IOF', 'bank fees': 'Tarifas bancárias', 'account fees': 'Tarifa de conta',
  'credit card fees': 'Tarifas do cartão', 'housing': 'Moradia', 'rent': 'Aluguel', 'utilities': 'Contas da casa', 'water': 'Água',
  'electricity': 'Energia', 'gas': 'Gás', 'houseware': 'Casa e utilidades', 'urban land and building tax': 'IPTU',
  'healthcare': 'Saúde', 'dentist': 'Dentista', 'pharmacy': 'Farmácia', 'hospital clinics and labs': 'Clínicas e exames',
  'transportation': 'Transporte', 'taxi and ride-hailing': 'Táxi e aplicativo', 'public transportation': 'Transporte público',
  'car rental': 'Aluguel de carro', 'automotive': 'Automóvel', 'gas stations': 'Combustível', 'parking': 'Estacionamento',
  'tolls and in vehicle payment': 'Pedágio', 'vehicle ownership taxes and fees': 'IPVA e taxas do veículo',
  'vehicle maintenance': 'Manutenção do veículo', 'traffic tickets': 'Multas', 'insurance': 'Seguros', 'life insurance': 'Seguro de vida',
  'health insurance': 'Plano de saúde', 'vehicle insurance': 'Seguro do carro', 'home insurance': 'Seguro residencial',
  'leisure': 'Lazer', 'other': 'Outros',
};
const categoria = (tx) => {
  const c = String(tx.category ?? '').trim();
  return CATEGORIAS[c.toLowerCase()] || c || 'Sem categoria';
};
// Transferência entre contas próprias, pagamento de fatura e aplicação/resgate não são gasto nem receita:
// o dinheiro só muda de lugar (e o gasto do cartão já aparece nas compras).
const INTERNA_CATEGORIA = /^(same person transfer|credit card payment|investments|automatic investment|fixed income|mutual funds|variable income|pension)\b/i;
const INTERNA_DESCRICAO = /pagamento (de |da )?fatura|pgto\.? fatura|pag fatura|pagamento recebido|aplica[cç][aã]o|resgate|mesma titularidade|transf(\.|er[eê]ncia)? entre contas/i;
const interna = (tx) => INTERNA_CATEGORIA.test(String(tx.category ?? '')) || INTERNA_DESCRICAO.test(String(tx.description ?? ''));
const valorTx = (tx) => Math.abs(Number(tx.amountInAccountCurrency ?? tx.amount) || 0);
const nomeConta = (c) => {
  if (c.type === 'CREDIT') return `cartão ${c.marketingName || c.name || ''}${final4(c.number) ? ` final ${final4(c.number)}` : ''}`.replace(/\s+/g, ' ').trim();
  return c.subtype === 'SAVINGS_ACCOUNT' ? 'poupança' : 'conta corrente';
};

// --- conexões (um item do Meu Pluggy por banco) ---------------------------------------------------------
const falhas = [];
const conexoes = await Promise.all(
  pedido.conexoes.map(async (c) => {
    try {
      const [item, contas] = await Promise.all([pedir(`/items/${encodeURIComponent(c.item_id)}`), paginado('/accounts', { itemId: c.item_id })]);
      return { ...c, item, contas, banco: c.banco || deduzirBanco(contas) || item?.connector?.name || 'Banco' };
    } catch (e) {
      falhas.push({ banco: c.banco || c.item_id, erro: e.message, status: e.status });
      return null;
    }
  }),
).then((lista) => lista.filter(Boolean));

if (!conexoes.length) {
  const credencial = falhas.some((f) => f.status === 401 || f.status === 403);
  return [{
    json: {
      ok: false,
      erro: `Não consegui ler nenhum banco: ${falhas.map((f) => `${f.banco}: ${f.erro}`).join(' | ').slice(0, 600)}`,
      orientacao: credencial
        ? 'Diga ao dono que a Pluggy recusou o acesso: confira se o Client ID e o Client Secret da credencial "Pluggy (bancos)" são os da mesma aplicação onde os bancos foram conectados, e se os Item IDs da tabela kira_bancos estão certos. Não invente números.'
        : 'Diga ao dono que os bancos não responderam agora (pode ser o item_id errado na tabela kira_bancos ou instabilidade da Pluggy) e sugira tentar de novo. Não invente números.',
    },
  }];
}

// Filtro por banco (ex.: "nubank", "inter").
let usadas = conexoes;
if (pedido.banco) {
  const alvo = semAcento(pedido.banco);
  usadas = conexoes.filter((c) => semAcento(c.banco).includes(alvo) || alvo.includes(semAcento(c.banco)));
  if (!usadas.length) {
    return [{ json: { ok: false, erro: `Não achei o banco "${pedido.banco}" entre os conectados.`, bancos_conectados: conexoes.map((c) => c.banco) } }];
  }
}

const statusConexao = (c) =>
  semVazios({
    banco: c.banco,
    status: STATUS_ITEM[c.item?.status] || c.item?.status,
    dados_atualizados_em: quando(c.item?.lastUpdatedAt),
    consentimento_vence_em: dia(c.item?.consentExpiresAt),
    contas: c.contas.length,
  });
// Data dos dados: a sincronização mais antiga entre os bancos usados.
const atualizacoes = usadas.map((c) => c.item?.lastUpdatedAt).filter(Boolean).sort();
const base = semVazios({
  ok: true,
  tipo: pedido.tipo,
  fonte: 'Open Finance (Meu Pluggy), só leitura',
  dados_de: atualizacoes.length ? quando(atualizacoes[0]) : undefined,
  bancos: usadas.map((c) => c.banco),
  ...(falhas.length ? { bancos_com_falha: falhas.map((f) => `${f.banco}: ${f.erro.slice(0, 160)}`) } : {}),
});

const alertasConexao = () => {
  const alertas = [];
  for (const c of conexoes) {
    const s = c.item?.status;
    if (s && s !== 'UPDATED' && s !== 'UPDATING') alertas.push(`${c.banco}: conexão ${STATUS_ITEM[s] || s}`);
    const d = diasAte(c.item?.consentExpiresAt);
    if (d !== undefined && d <= 15) alertas.push(`${c.banco}: o consentimento do Open Finance vence em ${Math.max(d, 0)} dia(s); renove no Meu Pluggy`);
  }
  return alertas;
};

const contaBancaria = (c, banco) =>
  semVazios({
    banco,
    conta: nomeConta(c),
    saldo: r2(c.balance),
    aplicado_automaticamente: temValor(c.bankData?.automaticallyInvestedBalance) && Number(c.bankData.automaticallyInvestedBalance) ? r2(c.bankData.automaticallyInvestedBalance) : undefined,
    moeda: c.currencyCode && c.currencyCode !== 'BRL' ? c.currencyCode : undefined,
  });
const cartao = (c, banco) =>
  semVazios({
    banco,
    cartao: nomeConta(c),
    fatura_atual: r2(c.balance),
    fechamento: dia(c.creditData?.balanceCloseDate),
    vencimento: dia(c.creditData?.balanceDueDate),
    vence_em_dias: diasAte(c.creditData?.balanceDueDate),
    pagamento_minimo: temValor(c.creditData?.minimumPayment) ? r2(c.creditData.minimumPayment) : undefined,
    limite: temValor(c.creditData?.creditLimit) ? r2(c.creditData.creditLimit) : undefined,
    limite_disponivel: temValor(c.creditData?.availableCreditLimit) ? r2(c.creditData.availableCreditLimit) : undefined,
  });

// --- investimentos --------------------------------------------------------------------------------------
const TIPOS_INVESTIMENTO = {
  FIXED_INCOME: 'Renda fixa', MUTUAL_FUND: 'Fundos', EQUITY: 'Ações', SECURITY: 'Previdência e títulos',
  ETF: 'ETFs', COE: 'COE', OTHER: 'Outros',
};
const lerInvestimentos = async (lista) => {
  const posicoes = [];
  await Promise.all(
    lista.map(async (c) => {
      try {
        for (const i of await paginado('/investments', { itemId: c.item_id })) {
          if (i.status && i.status !== 'ACTIVE') continue;
          posicoes.push(
            semVazios({
              banco: c.banco,
              nome: i.name,
              tipo: TIPOS_INVESTIMENTO[i.type] || i.type,
              subtipo: i.subtype,
              saldo: r2(i.balance ?? i.amount),
              vencimento: dia(i.dueDate),
              taxa: temValor(i.rate) ? `${i.rate}${i.rateType ? ` ${i.rateType}` : ''}` : undefined,
              rendimento_12m: temValor(i.annualRate) ? i.annualRate : undefined,
              emissor: i.issuer,
            }),
          );
        }
      } catch (e) {
        falhas.push({ banco: c.banco, erro: `investimentos: ${e.message}`, status: e.status });
      }
    }),
  );
  return posicoes.sort((a, b) => b.saldo - a.saldo);
};

// --- transações -----------------------------------------------------------------------------------------
const lerTransacoes = async (lista) => {
  const todas = [];
  const tarefas = [];
  for (const c of lista) {
    for (const conta of c.contas) {
      tarefas.push(
        transacoesDaConta(conta.id)
          .then((txs) => {
            for (const tx of txs) todas.push({ tx, conta, banco: c.banco });
          })
          .catch((e) => falhas.push({ banco: c.banco, erro: `${nomeConta(conta)}: ${e.message}`, status: e.status })),
      );
    }
  }
  await Promise.all(tarefas);
  return todas;
};
const resumoTx = ({ tx, conta, banco }) =>
  semVazios({
    data: dia(tx.date),
    descricao: String(tx.description ?? '').replace(/\s+/g, ' ').trim(),
    estabelecimento: tx.merchant?.businessName || tx.merchant?.name,
    valor: r2(valorTx(tx)),
    sentido: tx.type === 'CREDIT' ? 'entrada' : 'saída',
    categoria: categoria(tx),
    banco,
    conta: nomeConta(conta),
    parcela: tx.creditCardMetadata?.totalInstallments > 1 ? `${tx.creditCardMetadata.installmentNumber}/${tx.creditCardMetadata.totalInstallments}` : undefined,
    pendente: tx.status === 'PENDING' ? true : undefined,
    entre_suas_contas: interna(tx) ? true : undefined,
    moeda_original: tx.currencyCode && tx.currencyCode !== (conta.currencyCode || 'BRL') ? `${tx.currencyCode} ${r2(Math.abs(tx.amount))}` : undefined,
  });
// Busca: texto (descrição, estabelecimento ou categoria) ou "entradas" / "saídas".
const filtrarBusca = (lista) => {
  const b = semAcento(pedido.busca);
  if (!b) return lista;
  if (/^(entradas?|receitas?|recebimentos?|creditos?)$/.test(b)) return lista.filter(({ tx }) => tx.type === 'CREDIT' && !interna(tx));
  if (/^(saidas?|gastos?|despesas?|debitos?|compras?)$/.test(b)) return lista.filter(({ tx }) => tx.type !== 'CREDIT' && !interna(tx));
  return lista.filter(({ tx, conta }) =>
    semAcento([tx.description, tx.merchant?.businessName, tx.merchant?.name, tx.category, categoria(tx), nomeConta(conta)].join(' ')).includes(b),
  );
};
const ordenarPorData = (lista) => lista.sort((a, b) => String(b.tx.date ?? '').localeCompare(String(a.tx.date ?? '')));
const periodo = { desde: DateTime.fromISO(pedido.desde).toFormat('dd/MM/yyyy'), ate: DateTime.fromISO(pedido.ate).toFormat('dd/MM/yyyy') };

// --- respostas por tipo ---------------------------------------------------------------------------------
const tipo = pedido.tipo;

if (tipo === 'conexoes') {
  return [{ json: { ...base, conexoes: conexoes.map(statusConexao), alertas: alertasConexao() } }];
}

if (tipo === 'resumo') {
  const contas = [];
  const cartoes = [];
  for (const c of usadas) {
    for (const conta of c.contas) (conta.type === 'CREDIT' ? cartoes : contas).push(conta.type === 'CREDIT' ? cartao(conta, c.banco) : contaBancaria(conta, c.banco));
  }
  const investimentos = await lerInvestimentos(usadas);
  const emConta = r2(contas.filter((c) => !c.moeda).reduce((s, c) => s + c.saldo + (c.aplicado_automaticamente || 0), 0));
  const faturas = r2(cartoes.reduce((s, c) => s + Math.max(c.fatura_atual, 0), 0));
  const investido = r2(investimentos.reduce((s, i) => s + i.saldo, 0));
  const alertas = alertasConexao();
  for (const c of cartoes) {
    if (c.vence_em_dias !== undefined && c.vence_em_dias >= 0 && c.vence_em_dias <= 7 && c.fatura_atual > 0) {
      alertas.push(`Fatura do ${c.cartao} (${c.banco}) vence em ${c.vence_em_dias} dia(s), dia ${c.vencimento}`);
    }
  }
  for (const c of contas) if (c.saldo < 0) alertas.push(`${c.banco}: ${c.conta} está negativa (cheque especial)`);
  return [{
    json: {
      ...base,
      ...(falhas.length ? { bancos_com_falha: falhas.map((f) => `${f.banco}: ${f.erro.slice(0, 160)}`) } : {}),
      total_em_conta: emConta,
      total_investido: investido,
      total_faturas_abertas: faturas,
      patrimonio_liquido: r2(emConta + investido - faturas),
      contas,
      cartoes,
      investimentos_por_tipo: Object.entries(
        investimentos.reduce((acc, i) => ({ ...acc, [i.tipo]: r2((acc[i.tipo] || 0) + i.saldo) }), {}),
      ).map(([t, total]) => ({ tipo: t, total })),
      alertas,
      observacao: 'Saldos como os bancos informaram na última sincronização (dados_de). Patrimônio líquido = contas + investimentos - faturas abertas (não inclui imóveis, carro nem dívidas fora do cartão).',
    },
  }];
}

if (tipo === 'investimentos') {
  const investimentos = await lerInvestimentos(usadas);
  const total = r2(investimentos.reduce((s, i) => s + i.saldo, 0));
  return [{
    json: {
      ...base,
      ...(falhas.length ? { bancos_com_falha: falhas.map((f) => `${f.banco}: ${f.erro.slice(0, 160)}`) } : {}),
      total_investido: total,
      por_tipo: Object.entries(investimentos.reduce((acc, i) => ({ ...acc, [i.tipo]: r2((acc[i.tipo] || 0) + i.saldo) }), {})).map(([t, v]) => ({
        tipo: t,
        total: v,
        percentual: total ? r2((v / total) * 100) : 0,
      })),
      posicoes: investimentos.slice(0, 40),
      ...(investimentos.length > 40 ? { cortado: `mostrando 40 de ${investimentos.length} posições` } : {}),
    },
  }];
}

if (tipo === 'faturas') {
  const saida = [];
  await Promise.all(
    usadas.flatMap((c) =>
      c.contas
        .filter((conta) => conta.type === 'CREDIT')
        .map(async (conta) => {
          let anteriores = [];
          try {
            anteriores = (await paginado('/bills', { accountId: conta.id }))
              .sort((a, b) => String(b.dueDate ?? '').localeCompare(String(a.dueDate ?? '')))
              .slice(0, 6)
              .map((f) => semVazios({
                vencimento: dia(f.dueDate),
                total: r2(f.totalAmount),
                pagamento_minimo: temValor(f.minimumPaymentAmount) ? r2(f.minimumPaymentAmount) : undefined,
              }));
          } catch (e) {
            falhas.push({ banco: c.banco, erro: `faturas do ${nomeConta(conta)}: ${e.message}`, status: e.status });
          }
          saida.push({ ...cartao(conta, c.banco), faturas_fechadas: anteriores });
        }),
    ),
  );
  return [{
    json: {
      ...base,
      ...(falhas.length ? { bancos_com_falha: falhas.map((f) => `${f.banco}: ${f.erro.slice(0, 160)}`) } : {}),
      total_faturas_abertas: r2(saida.reduce((s, c) => s + Math.max(c.fatura_atual || 0, 0), 0)),
      cartoes: saida,
      ...(saida.length ? {} : { aviso: 'Nenhum cartão de crédito nos bancos consultados.' }),
    },
  }];
}

// transacoes e gastos precisam do extrato do período.
const todas = await lerTransacoes(usadas);
const filtradas = filtrarBusca(todas);
const comFalhas = falhas.length ? { bancos_com_falha: falhas.map((f) => `${f.banco}: ${f.erro.slice(0, 160)}`) } : {};

if (tipo === 'gastos') {
  const saidas = filtradas.filter(({ tx }) => tx.type !== 'CREDIT' && !interna(tx));
  const entradas = filtradas.filter(({ tx, conta }) => tx.type === 'CREDIT' && !interna(tx) && conta.type !== 'CREDIT');
  const estornos = filtradas.filter(({ tx, conta }) => tx.type === 'CREDIT' && !interna(tx) && conta.type === 'CREDIT');
  const internas = filtradas.filter(({ tx }) => interna(tx));
  const soma = (lista) => r2(lista.reduce((s, x) => s + valorTx(x.tx), 0));
  const totalGastos = soma(saidas);
  const porCategoria = {};
  for (const x of saidas) {
    const k = categoria(x.tx);
    porCategoria[k] ??= { categoria: k, total: 0, transacoes: 0 };
    porCategoria[k].total += valorTx(x.tx);
    porCategoria[k].transacoes += 1;
  }
  const porBanco = {};
  for (const x of [...saidas, ...entradas]) {
    porBanco[x.banco] ??= { banco: x.banco, gastos: 0, entradas: 0 };
    porBanco[x.banco][x.tx.type === 'CREDIT' ? 'entradas' : 'gastos'] += valorTx(x.tx);
  }
  const porEstabelecimento = {};
  for (const x of saidas) {
    const k = x.tx.merchant?.businessName || x.tx.merchant?.name || String(x.tx.description ?? '').replace(/\s+/g, ' ').trim();
    porEstabelecimento[k] ??= { nome: k, total: 0, vezes: 0 };
    porEstabelecimento[k].total += valorTx(x.tx);
    porEstabelecimento[k].vezes += 1;
  }
  const dias = Math.max(1, Math.round(DateTime.fromISO(pedido.ate).diff(DateTime.fromISO(pedido.desde), 'days').days) + 1);
  return [{
    json: {
      ...base,
      ...comFalhas,
      periodo,
      ...(pedido.busca ? { filtro: pedido.busca } : {}),
      total_gastos: totalGastos,
      total_entradas: soma(entradas),
      resultado_do_periodo: r2(soma(entradas) - totalGastos),
      media_gastos_por_dia: r2(totalGastos / dias),
      ...(estornos.length ? { estornos_no_cartao: soma(estornos) } : {}),
      por_categoria: Object.values(porCategoria)
        .sort((a, b) => b.total - a.total)
        .slice(0, 25)
        .map((c) => ({ ...c, total: r2(c.total), percentual: totalGastos ? r2((c.total / totalGastos) * 100) : 0 })),
      maiores_estabelecimentos: Object.values(porEstabelecimento)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map((e) => ({ ...e, total: r2(e.total) })),
      maiores_gastos: [...saidas].sort((a, b) => valorTx(b.tx) - valorTx(a.tx)).slice(0, 10).map(resumoTx),
      por_banco: Object.values(porBanco).map((b) => ({ banco: b.banco, gastos: r2(b.gastos), entradas: r2(b.entradas) })),
      fora_da_conta: {
        movimentacoes: internas.length,
        total: soma(internas),
        motivo: 'Transferências entre contas próprias, pagamento de fatura e aplicações/resgates não contam como gasto nem entrada: o dinheiro só mudou de lugar e as compras do cartão já estão nos gastos.',
      },
    },
  }];
}

// tipo === 'transacoes'
const ordenadas = ordenarPorData(filtradas);
const lista = ordenadas.slice(0, pedido.limite).map(resumoTx);
const externas = filtradas.filter(({ tx }) => !interna(tx));
return [{
  json: {
    ...base,
    ...comFalhas,
    periodo,
    ...(pedido.busca ? { filtro: pedido.busca } : {}),
    total_encontrado: filtradas.length,
    total_entradas: r2(externas.filter(({ tx, conta }) => tx.type === 'CREDIT' && conta.type !== 'CREDIT').reduce((s, x) => s + valorTx(x.tx), 0)),
    total_saidas: r2(externas.filter(({ tx }) => tx.type !== 'CREDIT').reduce((s, x) => s + valorTx(x.tx), 0)),
    ...(filtradas.length > lista.length ? { cortado: `mostrando as ${lista.length} mais recentes de ${filtradas.length}` } : {}),
    transacoes: lista,
    observacao: 'Os totais não contam o que está marcado como entre_suas_contas (transferência entre contas próprias, pagamento de fatura, aplicação e resgate).',
  },
}];
