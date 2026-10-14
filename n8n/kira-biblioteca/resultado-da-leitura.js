// Junta o texto que o Gemini escreveu. Na memorização, separa título, autor, área e páginas do cabeçalho do fichamento.
const plano = $('Decidir').first().json;
const candidato = $input.first().json;
const texto = (candidato.content?.parts ?? [])
  .filter((p) => !p.thought && typeof p.text === 'string')
  .map((p) => p.text)
  .join('')
  .trim();

if (!texto) {
  return [
    {
      json: {
        ok: false,
        acao: plano.acao,
        memorizar: false,
        orientacao:
          'O Gemini não devolveu texto ao ler "' + plano.arquivo_nome + '" (' + (candidato.finishReason || 'sem resposta') +
          '). Explique em poucas palavras e sugira tentar de novo; se for um PDF escaneado sem texto ou protegido por senha, diga isso.',
      },
    },
  ];
}

if (plano.acao !== 'memorizar') {
  return [
    {
      json: {
        ok: true,
        acao: 'ler',
        memorizar: false,
        livro: plano.arquivo_nome,
        resposta: texto.slice(0, 15000),
        orientacao: 'Responda à pergunta com base nisto, citando as páginas. Não copie trechos longos do livro.',
      },
    },
  ];
}

const campo = (...nomes) => {
  for (const nome of nomes) {
    const achado = texto.match(new RegExp('^[\\s*#_-]*' + nome + '[\\s*_]*:[\\s*_]*(.+)$', 'mi'));
    if (achado) return achado[1].replace(/[*_]+/g, '').trim();
  }
  return '';
};
const titulo = campo('TÍTULO', 'TITULO') || String(plano.arquivo_nome).replace(/\.[a-z0-9]{2,4}$/i, '');
const paginas = parseInt(campo('PÁGINAS', 'PAGINAS').replace(/\D+/g, ' ').trim().split(' ')[0], 10) || 0;

return [
  {
    json: {
      ok: true,
      acao: 'memorizar',
      memorizar: true,
      arquivo_id: plano.arquivo_id,
      arquivo_nome: plano.arquivo_nome,
      tipo: plano.tipo,
      titulo: titulo.slice(0, 300),
      autor: campo('AUTOR', 'AUTORES', 'AUTOR\\(ES\\)').slice(0, 300),
      area: (plano.area || campo('ÁREA', 'AREA')).slice(0, 60),
      paginas,
      fichamento: texto,
      cortado: /MAX_TOKENS/i.test(String(candidato.finishReason ?? '')),
      memorizado_em: DateTime.now().setZone('America/Sao_Paulo').toFormat('dd/MM/yyyy HH:mm'),
    },
  },
];
