# Exemplo de entrega completa

**Pedido do usuário:** "Quero uma foto de anúncio de um relógio masculino de aço com mostrador azul, segurado na mão, para o feed do Instagram."

---

## 🎬 Conceito criativo
HERO SHOT em estética de estúdio escuro: uma mão masculina apresenta o relógio pelas laterais da caixa, com o mostrador azul de frente para a câmera, para que o comprador veja exatamente o que está levando. Luz principal de strip box desenha o aço polido; um rim frio separa mão e relógio do fundo grafite e conversa com o azul do mostrador.
Suposições: pulseira de elos em aço, sem texto no mostrador além do que o cliente informar; gerador não informado, então o prompt vai em texto corrido com blocos.

## 📝 Prompt final (inglês)
```
SUBJECT: A men's stainless steel wristwatch, 41 mm round case, polished bezel, deep sunburst blue dial with applied silver baton indices and silver hands, three-link stainless steel bracelet with brushed outer links and polished center links. Product proportions, colors and details exactly as described; no added logos or text on the dial.

HAND INTERACTION: A single adult male right hand, light-medium skin tone, presents the watch toward the camera. The thumb rests on the left side of the case near the 9 o'clock position, the index finger supports the case from behind at 3 o'clock, the middle finger lightly cradles the bracelet underneath; ring and little fingers curl naturally out of focus. The bracelet drapes down with visible weight, links slightly angled by gravity. Soft skin compression and a thin contact shadow where the thumb and index finger touch the steel.

COMPOSITION: Vertical 4:5 frame, watch centered slightly above the middle, dial facing the camera square-on, camera at dial height with a 5-degree downward tilt. Hand enters from the lower right. Generous negative space in the upper third for ad copy.

LIGHTING: Large vertical strip softbox at camera left as key, reflected as a clean gradient band along the polished bezel; subtle white fill card at right; cool blue rim light from behind right separating the hand and bracelet from the background; black flags shaping crisp edges on the case. The sunburst dial shows a radial light streak from the key.

MATERIAL REALISM: Polished steel with mirror-like reflections and defined edges; brushed links with fine linear grain and anisotropic highlights; dial with sunburst texture and slight depth under the crystal; sapphire crystal with a faint reflection of the softbox. Skin with visible pores on the knuckles, fine flexion creases, natural cuticles, slight warmth at the fingertips, subtle subsurface glow at the finger edges.

CAMERA: Full-frame camera, 100 mm macro lens, f/8, focus plane on the dial and the thumb tip, background falling into soft blur.

ENVIRONMENT: Seamless matte graphite background with a soft gradient falloff toward the edges, no props.

FINAL AESTHETIC: Premium watch advertising, cinematic contrast, neutral color grading preserving the true blue of the dial, fine sensor grain, clean and editorial.

CONSTRAINTS: Exactly five fingers with natural joints; no fused or extra fingers; watch geometry, dial color and bracelet design unchanged; no invented text, logos or watermarks; no plastic or waxy skin; no floating watch — visible contact and weight.
```

## 🚫 Restrições de geração
- Mostrador azul e índices prateados idênticos; nenhum texto inventado no mostrador.
- Uma só mão direita, cinco dedos, dois visíveis em contato com a caixa.
- Sombra de contato e compressão leve na pele onde segura.
- Negative prompt (SD/Leonardo): `extra fingers, fused fingers, deformed hand, plastic skin, invented logo, text on dial, warped case, cgi, 3d render, oversaturated blue`

## ⚙️ Configuração recomendada
- Proporção: 4:5 (feed do Instagram)
- Enquadramento: plano fechado, relógio + mão até o meio da palma
- Lente / abertura: 100 mm macro, f/8
- Iluminação: strip box principal à esquerda, rebatedor à direita, rim azul por trás
- Gerador: Midjourney → texto corrido + `--ar 4:5 --style raw --no extra fingers, text, watermark`; Gemini/ChatGPT → cole como está e anexe a foto do relógio, se houver.
