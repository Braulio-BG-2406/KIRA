// Normaliza o pedido da Kira: acao (listar, memorizar, consultar ou ler), livro, pergunta e, para PDFs fora da
// pasta da biblioteca, o id e o tipo do arquivo que vieram de buscar_arquivos_drive.
const e = $input.first().json;
const limpar = (v) => String(v ?? '').trim();
const chave = limpar(e.acao).toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
const acoes = {
  listar: 'listar', lista: 'listar', livros: 'listar',
  memorizar: 'memorizar', memoriza: 'memorizar', estudar: 'memorizar', aprender: 'memorizar', guardar: 'memorizar',
  consultar: 'consultar', consulta: 'consultar', perguntar: 'consultar', pergunta: 'consultar',
  ler: 'ler', abrir: 'ler', reler: 'ler',
};
const pergunta = limpar(e.pergunta).slice(0, 4000);

return [
  {
    json: {
      acao: acoes[chave] || (pergunta ? 'consultar' : 'listar'),
      livro: limpar(e.livro).slice(0, 200),
      pergunta,
      arquivo_id: limpar(e.arquivo_id).replace(/[^A-Za-z0-9_-]/g, ''),
      tipo_arquivo: limpar(e.tipo_arquivo),
      area: limpar(e.area).slice(0, 60),
      chat_id: limpar(e.chat_id),
      pasta: 'Kira - Biblioteca',
    },
  },
];
