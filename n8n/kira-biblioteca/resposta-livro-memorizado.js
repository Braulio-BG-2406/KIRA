// Confirma a memorização com um resumo curto (o fichamento inteiro fica na tabela kira_biblioteca).
const r = $('Resultado da leitura').first().json;
const tese = (r.fichamento.match(/##\s*Tese central[^\n]*\n([\s\S]*?)(\n##|$)/i) || [])[1] || r.fichamento.slice(0, 800);

return [
  {
    json: {
      ok: true,
      acao: 'memorizar',
      titulo: r.titulo,
      autor: r.autor,
      area: r.area,
      paginas: r.paginas,
      tamanho_fichamento_caracteres: r.fichamento.length,
      tese_central: tese.trim().slice(0, 1500),
      fichamento_incompleto: r.cortado,
      orientacao:
        'Conte ao Bráulio, em poucas linhas, que você leu e memorizou o livro (título, autor, área e páginas) e resuma a tese central. Daqui em diante, perguntas sobre ele usam biblioteca com acao consultar.' +
        (r.cortado ? ' Avise que o livro é tão longo que o fichamento parou antes do fim: para os capítulos finais, use acao ler.' : ''),
    },
  },
];
