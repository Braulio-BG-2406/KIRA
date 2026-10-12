---
name: modelo-para-skill
description: Transforma um modelo de documento da empresa (planilha Excel ou documento preenchido, como APR, PT, checklist, relatório de inspeção, DDS, ordem de serviço, orçamento) numa skill que gera esse documento automaticamente, no mesmo layout, a partir de poucas informações. Analisa os exemplos, separa o que é fixo do que é variável, cria o molde, a biblioteca de textos e o script gerador, testa refazendo os exemplos e empacota a skill. Use quando o usuário disser "quero uma skill que faça nossos/nossas ...", "cria uma skill igual à da APR para ...", "automatiza esse formulário/modelo", ou mandar planilhas de exemplo pedindo que o Claude passe a gerar documentos iguais a eles.
---

# Modelo de documento → skill

Roteiro usado para criar a skill `apr-seguranca` (APR no modelo Anexo 9 da
TJ MONTAGENS) a partir de três planilhas de exemplo, generalizado para
qualquer documento padronizado. A ideia central: **o Claude escreve só o que
muda em cada documento; um script monta o resto igualzinho ao modelo.**

Antes de começar, se a skill `skill-creator` estiver disponível, use-a para
empacotar e validar no final. Este roteiro diz o *que* construir; ela ajuda no
formato de skill.

## Fase 0 — Exemplos de verdade, antes de tudo

Sem os arquivos reais não dá para reproduzir o layout. Construir antes em cima
de um modelo genérico foi retrabalho na primeira tentativa.

- Peça **2 ou 3 exemplos preenchidos de situações diferentes**, no formato
  original (.xlsx/.docx). PDF ajuda a ver como fica impresso, mas não serve de
  molde.
- Um caminho como `C:\Users\...\arquivo.xlsx` colado no chat **não envia o
  arquivo**: o Claude roda em outro computador. Formas que funcionam: anexar
  na conversa; subir no GitHub (Adicionar arquivo → Carregar arquivos);
  colocar numa pasta do OneDrive/SharePoint conectado; link de
  compartilhamento.
- **Privacidade:** se for subir num repositório, confira se ele é público.
  Exemplos costumam ter nomes, telefones, assinaturas e fotos de pessoas.
  Avise o usuário antes e prefira repositório privado.

## Fase 1 — Entrevista curta

Pergunte só o que os exemplos não respondem:
- O que o usuário vai informar a cada documento (só o nome do serviço? local?
  equipe?) e o que o Claude deve deduzir.
- Quais campos são automáticos (datas e suas regras, numeração, responsáveis).
- O nome do arquivo de saída e o formato (.xlsx, PDF ou ambos).
- Quem assina e se os nomes ficam em branco para preencher à mão.

## Fase 2 — Diagnóstico do modelo

Use os scripts desta skill (rode com `python3`, sempre numa pasta nova):

1. `scripts/limpar_xlsx.py exemplo.xlsx limpo.xlsx` — remove caixas de texto
   vazias acumuladas (nas APRs eram ~71 mil por arquivo, deixando-os com 5 MB
   e lentos). Avise o usuário se encontrar isso.
2. `scripts/renderizar.py limpo.xlsx --saida render` — veja `grade.png` para
   entender as páginas.
3. `scripts/inspecionar_xlsx.py limpo.xlsx` e depois
   `--linhas 1-20 --estilos` na primeira página — larguras, alturas,
   mesclas, quebras de página, impressão, fontes e cores.
4. `scripts/extrair_imagens.py limpo.xlsx imagens` — veja `contato.png` e
   em que linha fica cada imagem.
5. Leia o texto de todos os exemplos lado a lado e marque o que se repete
   igual em todos.

## Fase 3 — Separar o fixo do variável

Monte uma tabela para você mesmo (e mostre um resumo ao usuário):

| Fixo (vai para a skill) | Variável (o Claude escreve a cada vez) |
|---|---|
| layout da página, cabeçalho, assinaturas | nome do serviço, local |
| seções/etapas padrão com texto idêntico | passos de execução, ferramentas |
| catálogo de itens repetidos (ex.: risco → medidas) | quais itens do catálogo se aplicam |
| nomes, telefones, empresa | itens fora do catálogo |
| pictogramas | fotos específicas do serviço |

Copie os textos fixos **literalmente** (é o padrão já aceito pelo cliente);
corrija só erros de digitação evidentes e conte ao usuário quais.

## Fase 4 — Construir a skill

Estrutura e detalhes técnicos em `references/arquitetura-gerador.md`; código
completo de referência em `references/exemplo_gerar_apr.py`.

1. **Molde:** `scripts/criar_molde.py limpo.xlsx assets/modelo.xlsx --manter
   1-19 --limpar <células variáveis>` — guarda só o bloco que se repete.
2. **`assets/biblioteca.json`:** textos fixos e catálogos.
3. **`assets/config.json`:** nomes, telefones, empresa.
4. **`assets/fotos/`:** só pictogramas genéricos; nada de fotos de pessoas ou
   do local sem autorização (ofereça um arquivo opcional, ex.
   `equipe.jpg`).
5. **`scripts/gerar_<doc>.py`:** lê o JSON, calcula datas, monta as páginas a
   partir do molde, numera, continua entre páginas, insere fotos, salva
   .xlsx e PDF. Valide o JSON com mensagens claras (ex.: lista das chaves
   válidas do catálogo).
6. **`SKILL.md` da nova skill:** descrição "insistente" com as palavras que o
   usuário usa (sigla, nome do formulário, tipos de serviço); fluxo; formato
   do JSON com um exemplo completo; tabela do catálogo com "use quando";
   regras de coerência (ex.: tem solda → fumos, queimaduras, incêndio).

## Fase 5 — Testar refazendo os exemplos

1. Para cada exemplo, escreva o JSON como o Claude escreveria só com o nome
   do serviço e gere o documento.
2. `scripts/renderizar.py gerado.xlsx --comparar original_limpo.xlsx --saida
   comparacao` — confira `lado-a-lado-N.png`.
3. Confira de perto (`--dpi 120 --paginas N`): texto cortado, sobra de espaço,
   datas no formato dd/mm/aaaa, fotos no lugar, quebras de página.
4. Calibre caracteres por linha e altura de linha (seção 7 da referência).
5. Teste um JSON com erro e veja se a mensagem ajuda.

## Fase 6 — Entregar

1. Valide e empacote (com a `skill-creator`: `quick_validate` e
   `package_skill`; sem ela, zip da pasta com `SKILL.md` na raiz da pasta da
   skill).
2. Envie o `.skill` ao usuário (botão "Save skill" instala) e, se houver
   repositório, salve em `.claude/skills/<nome>/` e faça commit/push.
3. Mande também os documentos de teste para o usuário comparar.
4. Resumo curto: o que a skill faz, o que foi copiado do modelo, o que você
   escreveu de novo (para ele revisar), o que ficou de fora (fotos de
   pessoas) e os avisos de privacidade.

## Checklist de lições aprendidas

- [ ] Arquivos reais em mãos antes de construir qualquer coisa.
- [ ] Lixo removido (caixas de texto vazias, links externos, nomes definidos
      quebrados).
- [ ] Textos fixos copiados literalmente; correções avisadas.
- [ ] Datas calculadas no script e com formato `DD/MM/YYYY` explícito.
- [ ] Altura de linha calibrada pelo Excel (Arial 10 = 12,75 pt), não pelo
      LibreOffice.
- [ ] Nenhum bloco minúsculo sobrando sozinho numa página.
- [ ] Fotos de pessoas/local fora da skill sem autorização; repositório
      público avisado.
- [ ] Exemplos refeitos e comparados lado a lado com os originais.
