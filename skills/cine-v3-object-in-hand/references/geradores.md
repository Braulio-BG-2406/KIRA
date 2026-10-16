# Ajustes por gerador

O prompt base (blocos SUBJECT → CONSTRAINTS) serve para todos. Ajuste só a forma de entregar. Os recursos dessas ferramentas mudam com frequência; se o usuário disser que uma opção não existe na versão dele, adapte para o que ele vê na tela.

Se o usuário não disser o gerador, entregue o prompt em texto corrido com os blocos rotulados (funciona em quase todos) e informe a proporção na configuração.

## Gemini (Nano Banana / geração de imagem do Gemini)
- Prefere linguagem natural descritiva. Os blocos rotulados funcionam bem.
- Com foto do produto: anexe a imagem e comece o prompt com "Use the attached photo as the exact reference for the product: keep its shape, proportions, colors, logo and all printed text unchanged."
- Proporção: diga no texto ("vertical 4:5 composition") ou escolha na interface, se houver.
- Também é bom para corrigir só a mão numa imagem já gerada: "Edit only the hand: ... Keep the product and background exactly as they are."

## ChatGPT (GPT Image)
- Linguagem natural; segue bem instruções longas e listas de restrições.
- Com foto: anexe e peça para preservar o produto como no Gemini.
- Proporção: informe no texto (quadrado, vertical, horizontal).
- Bom em texto legível de rótulos — mesmo assim, escreva o texto exato entre aspas.

## Midjourney
- Texto corrido, mais enxuto: remova os rótulos ou deixe só os essenciais; o modelo dá peso maior ao começo do prompt, então comece por produto + mão.
- Parâmetros no final: `--ar 4:5` (proporção), `--style raw` (menos "estilização", mais fotográfico), `--no` para o que evitar (ex.: `--no extra fingers, text, watermark`).
- Referência do produto: coloque a URL da imagem no início do prompt (image prompt) e ajuste o peso com `--iw`; nas versões que oferecem omni reference, `--oref <url>` com `--ow` ajuda a manter o objeto.
- Não entende bem negação dentro do texto ("no logo") — use `--no`.

## Flux
- Linguagem natural detalhada; responde bem a termos de câmera e luz.
- Muitas versões não usam negative prompt: escreva as restrições em forma positiva ("clean background with no text", "exactly five fingers, each with three visible segments").

## Stable Diffusion / SDXL (ComfyUI, Automatic1111)
- Separe prompt positivo e **negative prompt**.
- Negative típico: `extra fingers, fused fingers, missing fingers, deformed hands, plastic skin, waxy skin, distorted product, warped text, invented logo, watermark, cgi, 3d render, oversaturated`.
- Para mãos difíceis, sugira ControlNet (pose/depth) ou inpainting só na mão.

## Leonardo
- Linguagem natural; use o recurso de referência de imagem (image guidance / content reference) com a foto do produto.
- Negative prompt disponível em vários modelos — use o mesmo da seção SD.

## Adobe Firefly
- Linguagem natural; use a referência de composição para manter posição do produto e a de estilo para a estética.
- Bom em fotografia publicitária "limpa"; menos indicado para INDUSTRIAL REALISM sujo.

## Regra geral para imagem de referência
Quando houver foto do produto, a ordem de prioridade no prompt é:
1. Instrução de preservar o produto da referência.
2. Descrição do produto conforme a foto (reforça o que o modelo deve manter).
3. Mão, composição, luz e o resto.
