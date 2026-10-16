# Defeitos comuns e como corrigir

Princípio: o defeito quase sempre vem de **ambiguidade** no prompt. Corrija tirando a ambiguidade, não acrescentando "perfect", "realistic" ou "high quality".

| Defeito | Causa provável | Correção no prompt |
|---|---|---|
| Dedos a mais ou a menos | Pegada vaga; muitos dedos visíveis | Descreva quais dedos aparecem e onde: "thumb on the front face, index and middle fingers behind, ring and little fingers curled out of frame". Mostrar menos dedos reduz erro. |
| Dedos fundidos ou longos demais | Mão muito pequena no quadro ou ângulo confuso | Aproxime (85–100 mm), separe dedos com espaço visível ("small gaps between fingers"), descreva as três falanges e as dobras dos nós. |
| Mão de plástico / cera | Excesso de "flawless", "smooth", luz chapada | Remova termos de perfeição; descreva poros, dobras, cutículas, vermelhidão nas pontas; luz com direção para criar microssombra. |
| Objeto flutuando / sem peso | Falta contato e sombra | Descreva pontos de contato, leve compressão da pele, sombra de contato sob os dedos, pulso levemente inclinado pelo peso. |
| Mão atravessando o produto | Pegada impossível para a forma | Escolha pegada compatível com a geometria (pinça para itens pequenos, palma aberta para apresentar, envolvente para cilindros). |
| Logo/texto inventado ou trocado | Texto não informado ou modelo "completando" | Escreva o texto exato entre aspas e a posição; se não souber o texto, peça "no text or logos on the product" ou use foto de referência. |
| Produto com proporção errada | Grande-angular, ângulo extremo, descrição solta | Dê dimensões ("about 4 cm tall, fits between thumb and index finger"), use 85–100 mm, ângulo próximo do nível do produto. |
| Cor do produto mudou | Grading forte; cor descrita vaga | Cor exata ("deep emerald green, not teal"); diga "neutral color grading, product colors unaltered". |
| Rótulo distorcido | Superfície curva + ângulo oblíquo | Gire o produto para o rótulo ficar de frente para a câmera; peça "label facing camera, flat and readable". |
| Metal sem brilho ou cinza | Luz sem reflexo para espelhar | Descreva a fonte refletida ("softbox reflected as a gradient band") e flags pretas para contraste. |
| Cara de render 3D / CGI | Fundo perfeito, sem grão, luz uniforme | Acrescente imperfeições plausíveis: microgrão de sensor, poeira mínima, leve queda de luz nas bordas, profundidade de campo real. |
| Duas mãos quando pediu uma | Pegada exige duas mãos ou prompt cita "hands" | Use singular em todo o prompt ("a single right hand") e pegada possível com uma mão. |
| Mão desproporcional ao produto | Sem referência de escala | Relacione tamanhos: "the bottle is roughly the length of the palm". |
| Joia "flutuando" no dedo | Anel/pulseira sem contato | Descreva o anel assentado na base do dedo com leve marca na pele; pulseira apoiada no osso do pulso. |

## Quando o defeito persiste
Depois de duas revisões sem melhora:
- Simplifique: menos dedos visíveis, pegada mais simples, fundo mais limpo.
- Troque o ângulo para que a área problemática saia do quadro ou fique desfocada.
- Gere com foto de referência do produto.
- Gere a imagem e corrija só a mão com edição/inpainting (Gemini, ChatGPT, Photoshop Generative Fill, SD inpainting).
