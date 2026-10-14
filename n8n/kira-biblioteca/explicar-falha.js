// Resume o erro para a Kira explicar ao dono (sem travar a conversa).
const item = $input.first().json;
const bruto = item.error ?? item;
const textos = [];
const coletar = (valor, profundidade = 0) => {
  if (!valor || profundidade > 4) return;
  if (typeof valor === 'string') {
    textos.push(valor);
    return;
  }
  if (typeof valor === 'object') {
    for (const chave of ['message', 'description']) {
      if (typeof valor[chave] === 'string') textos.push(valor[chave]);
    }
    coletar(valor.error, profundidade + 1);
  }
};
coletar(bruto);

let completo = '';
try {
  completo = JSON.stringify(bruto);
} catch (e) {
  completo = textos.join(' ');
}
const erro = [...new Set(textos.map((t) => t.trim()).filter(Boolean))].join(' — ').slice(0, 600) || 'erro desconhecido';
const tudo = completo + ' ' + erro;
const executou = (nome) => {
  try {
    return $(nome).isExecuted;
  } catch (e) {
    return false;
  }
};
let livro = '';
try {
  livro = $('Decidir').first().json.arquivo_nome || '';
} catch (e) {
  livro = '';
}

let orientacao;
if (/reconnect|refresh token|invalid_grant|revoked/i.test(tudo)) {
  orientacao =
    'A conexão do Google Drive no servidor da Kira expirou. Explique em poucas palavras que ele precisa abrir o n8n, entrar em Credenciais > "Google Drive account" e clicar em reconectar (fazer o login do Google de novo).';
} else if (executou('Resultado da leitura')) {
  orientacao = 'Eu li o livro, mas não consegui guardar o fichamento na memória. Explique em poucas palavras e sugira tentar memorizar de novo mais tarde.';
} else if (/quota|RESOURCE_EXHAUSTED|429|rate.?limit/i.test(tudo)) {
  orientacao =
    'O limite do Gemini acabou por agora (o plano gratuito tem limite de tokens por minuto e por dia, e um livro inteiro consome muito). Explique em poucas palavras e sugira tentar daqui a pouco, dividir o PDF em partes menores ou ativar o faturamento da chave do Gemini.';
} else if (/too large|exceed|too many pages|payload|413|token count|maximum number of tokens/i.test(tudo)) {
  orientacao = 'O livro é grande demais para ler de uma vez (até umas 1000 páginas ou 50 MB). Sugira dividir o PDF em partes (por capítulos) e colocar as partes na pasta "Kira - Biblioteca".';
} else if (/404|not ?found|403|forbidden|permission|insufficient/i.test(tudo)) {
  orientacao = 'Não achei o arquivo no Google Drive ou não tenho permissão para abri-lo. Explique em poucas palavras e peça para ele conferir o arquivo.';
} else {
  orientacao = 'Não consegui usar a biblioteca agora. Explique em poucas palavras e sugira tentar de novo daqui a pouco.';
}

return [{ json: { ok: false, livro, erro, orientacao } }];
