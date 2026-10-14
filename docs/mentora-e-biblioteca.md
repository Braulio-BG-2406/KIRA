# Kira — Mentora especialista e Biblioteca

## O que mudou

**1. Mentora especialista (modo Pessoal).** No ambiente Pessoal, a Kira vira professora particular em
engenharia, medicina, psicologia, neurociência, teologia, física quântica, leis da prosperidade, ciências
contábeis e direito (advocacia). Ela:

- responde dúvidas rápidas direto ao ponto e dá aulas em camadas (ideia simples → rigor técnico →
  exemplo resolvido ligado ao seu dia a dia → erros comuns → perguntas para fixar);
- faz quiz, plano de estudos, resumo de livro e flashcards;
- ensina pelas obras de referência de cada área (a "estante" em `n8n/kira-2.0/instrucoes_pessoal.md`),
  cita autor e obra e não inventa página, artigo de lei nem norma;
- confere na internet o que muda com o tempo (leis, impostos, diretrizes médicas, normas);
- separa ciência de crença e de autoajuda (por exemplo, física quântica de verdade × "misticismo quântico");
- tem cuidados de segurança: não diagnostica nem prescreve (SAMU 192 em sinais de alarme), indica o CVV
  (188) em sofrimento intenso e lembra que caso jurídico concreto precisa de advogado e decisão fiscal,
  de contador;
- guarda o seu progresso nos estudos na memória (categoria `estudo`) e retoma de onde parou.

Para entrar: `modo pessoal` (ou os novos apelidos `modo estudo`, `modo estudos`, `modo mentora`,
`modo professora`).

**2. Biblioteca (todos os modos).** Ferramenta nova `biblioteca`, que é o jeito real de a Kira
"memorizar livros":

| Ação | O que faz |
| --- | --- |
| `listar` | Mostra os livros da pasta **Kira - Biblioteca** do Google Drive e os já memorizados. |
| `memorizar` | O Gemini lê o livro **inteiro** (PDF, Documento do Google ou texto; até ~1000 páginas / 50 MB) e escreve um fichamento completo: capítulos com páginas, conceitos, fórmulas, citações curtas, aplicações, críticas e perguntas de revisão. O fichamento fica guardado para sempre na tabela `kira_biblioteca`. Leva alguns minutos; a Kira avisa no Telegram que começou. |
| `consultar` | Responde pelo fichamento guardado (rápido e sem gastar cota). Se o livro ainda não foi memorizado, lê o arquivo direto. |
| `ler` | Reabre o arquivo inteiro para achar trecho literal, página ou exercício. Também lê **qualquer PDF** do seu Drive (antes a Kira não lia PDF). |

### Como usar

1. Coloque os livros em PDF na pasta **Kira - Biblioteca** do Google Drive (a Kira cria a pasta sozinha
   no primeiro uso; se preferir, crie você com esse nome exato).
2. No Telegram: "Kira, quais livros tem na biblioteca?" → "memoriza o Guyton" → depois
   "segundo o Guyton, como o rim regula a pressão?" ou "me dá a página onde ele fala de néfron".

### Limites honestos

- Nenhuma IA consegue "memorizar todos os livros existentes" (são milhões, e a maioria tem direitos
  autorais). O que a Kira tem: o conhecimento do modelo Gemini (treinado em muito material dessas áreas),
  a estante de referência que orienta as aulas, a pesquisa na internet e, com a Biblioteca, a leitura
  integral e a memória permanente de cada livro que você colocar no Drive.
- Livros acima de ~1000 páginas ou 50 MB precisam ser divididos em partes (por capítulos).
- No plano gratuito do Gemini, ler um livro inteiro consome muitos tokens: livros grandes podem bater
  no limite por minuto/dia. A Kira avisa quando acontecer.
- EPUB e Word ainda não: salve como PDF.

## Onde fica cada coisa (n8n da VPS)

- **Kira 2.0 — Assistente pessoal**: campo `instrucoes_pessoal` no nó *Ambientes da Kira* (texto da
  Mentora, editável); campo `instrucoes_ambiente` no nó *Contexto da conversa* (injeta no prompt as
  instruções do ambiente ativo — dá para criar `instrucoes_hidrau` ou `instrucoes_negocios` do mesmo
  jeito); ferramenta `biblioteca`; seção "Biblioteca" no prompt.
- **Kira — Biblioteca (ferramenta)**: sub-workflow `icx5tJ1KA4e6mvVo`. Código dos nós Code em
  `n8n/kira-biblioteca/*.js`; o workflow inteiro em `n8n/kira-biblioteca/workflow.sdk.ts`.
- **Tabela** `kira_biblioteca`: um fichamento por arquivo (`arquivo_id`). Entra no backup de domingo.

## Pendência importante

A credencial **"Google Drive account"** do n8n expirou ("needs to be reconnected"). Enquanto ela não
for reconectada, a Biblioteca (e as outras ferramentas de Drive da Kira, e o backup) não acessam o Drive.
Para reconectar: n8n → *Credentials* → *Google Drive account* → *Reconnect* e fazer o login do Google.
