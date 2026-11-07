// Service worker mínimo do app das lojas: permite instalar na tela inicial e mostra um aviso quando
// a internet cai. Não guarda páginas nem preços em cache, para nunca mostrar estoque desatualizado.
const AVISO = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sem conexão</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0b0c;color:#f3efe6;font-family:system-ui,sans-serif;text-align:center;padding:24px">
<div><p style="font-size:22px;margin:0 0 8px">Você está sem internet</p><p style="color:#c2bdb4;margin:0 0 20px">Confira a conexão e tente de novo.</p>
<button onclick="location.reload()" style="background:#b89a67;color:#16130e;border:0;border-radius:10px;padding:12px 20px;font-size:15px">Tentar de novo</button></div></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => new Response(AVISO, { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});
