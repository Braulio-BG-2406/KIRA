// Normaliza o pedido da Kira (tipo, período, banco e busca) e confere se já há bancos conectados
// na tabela kira_bancos (um item_id do Meu Pluggy por banco).
const pedido = $('Quando a Kira consultar os bancos').first().json;
const conexoes = $input
  .all()
  .map((i) => i.json)
  .filter((c) => String(c.item_id ?? '').trim() && c.ativo !== false)
  .map((c) => ({ item_id: String(c.item_id).trim(), banco: String(c.banco ?? '').trim() }));

const semAcento = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
const TIPOS = {
  resumo: 'resumo', saldo: 'resumo', saldos: 'resumo', contas: 'resumo', geral: 'resumo', patrimonio: 'resumo',
  transacoes: 'transacoes', transacao: 'transacoes', extrato: 'transacoes', lancamentos: 'transacoes', movimentacoes: 'transacoes',
  gastos: 'gastos', despesas: 'gastos', categorias: 'gastos', orcamento: 'gastos',
  faturas: 'faturas', fatura: 'faturas', cartao: 'faturas', cartoes: 'faturas',
  investimentos: 'investimentos', investimento: 'investimentos', aplicacoes: 'investimentos',
  conexoes: 'conexoes', conexao: 'conexoes', status: 'conexoes',
};
const tipo = TIPOS[semAcento(pedido.tipo || 'resumo').replace(/[^a-z]/g, '')] || 'resumo';

// Datas em AAAA-MM-DD ou DD/MM/AAAA, no horário de Brasília. Sem data: últimos 30 dias (extrato) ou mês atual (gastos).
const fuso = 'America/Sao_Paulo';
const hoje = DateTime.now().setZone(fuso).startOf('day');
const lerData = (v) => {
  const t = String(v ?? '').trim();
  if (!t) return null;
  let d = DateTime.fromISO(t.slice(0, 10), { zone: fuso });
  if (!d.isValid) d = DateTime.fromFormat(t, 'dd/MM/yyyy', { zone: fuso });
  return d.isValid ? d.startOf('day') : null;
};
let ate = lerData(pedido.ate) || hoje;
let desde = lerData(pedido.desde) || (tipo === 'gastos' ? ate.startOf('month') : ate.minus({ days: 30 }));
if (desde > ate) [desde, ate] = [ate, desde];
if (ate > hoje) ate = hoje;
if (desde > ate) desde = ate;
// O Open Finance guarda cerca de 12 meses de histórico.
if (ate.diff(desde, 'days').days > 366) desde = ate.minus({ days: 366 });

const limite = Math.min(Math.max(Math.round(Number(pedido.limite) || 30), 1), 100);

if (!conexoes.length) {
  return [{
    json: {
      seguir: false,
      resposta: {
        ok: false,
        erro: 'Nenhum banco conectado ainda.',
        orientacao:
          'Diga ao dono, em poucas frases, que a ligação com os bancos ainda não terminou: ele precisa conectar os bancos no Meu Pluggy (meu.pluggy.ai), colar o Client ID e o Client Secret na credencial "Pluggy (bancos)" do n8n e cadastrar o Item ID de cada banco na tabela kira_bancos. Não invente saldos nem transações.',
      },
    },
  }];
}

return [{
  json: {
    seguir: true,
    tipo,
    desde: desde.toFormat('yyyy-MM-dd'),
    ate: ate.toFormat('yyyy-MM-dd'),
    banco: String(pedido.banco ?? '').trim(),
    busca: String(pedido.busca ?? '').trim(),
    limite,
    conexoes,
  },
}];
