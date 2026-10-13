// Falha ao entrar na Pluggy: quase sempre é a credencial "Pluggy (bancos)" (vazia, ou Client ID/Secret errados).
const entrada = $input.first().json;
const erro = entrada.error ?? entrada;
const detalhe =
  typeof erro === 'string'
    ? erro
    : erro?.message || erro?.description || (erro && typeof erro === 'object' && Object.keys(erro).length ? JSON.stringify(erro) : '');
const texto = String(detalhe ?? '').slice(0, 300);
const credencial = !texto || /400|401|403|unauthori[sz]ed|forbidden|credential|invalid|client/i.test(texto);
const orientacao = credencial
  ? 'Diga ao dono, em poucas frases, que a Kira não conseguiu entrar na Pluggy: no n8n, em Credentials, abra a credencial "Pluggy (bancos)" e confira o Client ID e o Client Secret (ficam no Meu Pluggy, na aba Aplicação). Não invente números.'
  : 'Explique ao dono, em uma frase, que a Pluggy não respondeu agora e sugira tentar de novo em alguns minutos. Não invente números.';
return [{ json: { ok: false, erro: `Não consegui entrar na Pluggy: ${texto || 'a credencial "Pluggy (bancos)" está vazia'}`, orientacao } }];
