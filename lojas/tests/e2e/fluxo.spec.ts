import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function entrarNoPainel(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill("admin@teste.local");
  await page.getByLabel("Senha").fill("senha-de-teste-e2e");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/admin");
}

let codigoPedido = "";

test("cliente compra no site e recebe o Pix", async ({ page }) => {
  await page.goto("/loja/infinite");
  await expect(page.getByRole("heading", { name: "Semijoias que acompanham você" })).toBeVisible();
  await page.getByRole("link", { name: /Anel Solitário/ }).first().click();
  await page.getByRole("button", { name: "Aro 18" }).click();
  await page.getByRole("button", { name: "Aumentar" }).click();
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await expect(page.getByRole("status")).toContainText("Adicionado");
  await page.getByRole("link", { name: "Ver carrinho" }).click();
  await expect(page.getByText("Aro 18")).toBeVisible();
  await page.getByRole("link", { name: "Finalizar compra" }).click();

  await page.getByRole("textbox", { name: "Nome completo", exact: true }).fill("Maria Teste");
  await page.getByRole("textbox", { name: "E-mail", exact: true }).fill("maria@teste.com");
  await page.getByRole("textbox", { name: "WhatsApp", exact: true }).fill("(11) 98888-7777");
  await page.getByRole("textbox", { name: "CEP", exact: true }).fill("01001-000");
  await page.getByRole("textbox", { name: "Rua", exact: true }).fill("Praça da Sé");
  await page.getByRole("textbox", { name: "Número", exact: true }).fill("100");
  await page.getByRole("textbox", { name: "Bairro", exact: true }).fill("Sé");
  await page.getByRole("textbox", { name: "Cidade", exact: true }).fill("São Paulo");
  await page.getByRole("combobox", { name: "UF" }).selectOption("SP");
  // frete de SP no catálogo de exemplo: R$ 14,90, e a entrega já vem marcada
  await expect(page.getByRole("radio", { name: /^Entrega/ })).toBeChecked();
  await expect(page.getByText("R$ 14,90").first()).toBeVisible();
  await page.getByPlaceholder("Cupom").fill("bemvindo10");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByText("Cupom BEMVINDO10")).toBeVisible();
  await page.getByRole("button", { name: "Fechar pedido" }).click();

  await page.waitForURL(/\/pedido\/[A-Z0-9]+$/);
  codigoPedido = page.url().split("/").pop()!;
  await expect(page.getByRole("heading", { name: "Pedido recebido!" })).toBeVisible();
  // 2 × 79,90 = 159,80 − 10% (15,98) + 14,90 = 158,72
  await expect(page.getByText("Total: R$ 158,72")).toBeVisible();
  await expect(page.getByAltText("QR Code do Pix")).toBeVisible();
  await expect(page.locator("p.font-mono")).toContainText("br.gov.bcb.pix");
});

test("loja confirma o pagamento, envia e o cliente acompanha", async ({ page }) => {
  await entrarNoPainel(page);
  await page.goto("/admin/pedidos");
  await page.getByRole("link", { name: "#1" }).click();
  await expect(page.getByText("Maria Teste")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar pagamento" }).click();
  await expect(page.getByText("Pagamento registrado.")).toBeVisible();
  await page.locator("select[name=status]").selectOption("enviado");
  await page.getByPlaceholder("Código de rastreio (opcional)").fill("AA123456789BR");
  await page.getByRole("button", { name: "Atualizar status" }).click();
  await expect(page.getByText("Status atualizado.")).toBeVisible();

  await page.goto("/admin/financeiro");
  await expect(page.getByRole("link", { name: "Pedido #1" })).toBeVisible();

  await page.goto(`/loja/infinite/pedido/${codigoPedido}`);
  await expect(page.getByRole("heading", { name: "Enviado" })).toBeVisible();
  await expect(page.getByText("AA123456789BR").first()).toBeVisible();
});

test("venda pelo WhatsApp no painel baixa o estoque", async ({ page }) => {
  await entrarNoPainel(page);
  await page.goto("/admin/pedidos/novo");
  await page.getByLabel("Buscar produto").fill("ponto de luz");
  await page.getByRole("button", { name: /Brinco Ponto de Luz/ }).click();
  await page.getByLabel("Quantidade").fill("3");
  await page.locator("section").filter({ hasText: "Cliente" }).getByLabel("Nome").fill("Joana do Zap");
  await page.getByRole("button", { name: "Registrar venda" }).click();
  await expect(page.getByText("Venda registrada.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pedido #2" })).toBeVisible();

  await page.goto("/admin/estoque");
  await expect(page.getByRole("cell", { name: "-3" })).toBeVisible();
});

test("cadastro de produto com foto aparece na vitrine", async ({ page }) => {
  await entrarNoPainel(page);
  await page.goto("/admin/produtos/novo");
  await page.getByLabel("Nome").fill("Tornozeleira Estrela");
  await page.getByLabel("Marca").fill("Infinite");
  await page.getByLabel("Preço (R$)").fill("59,90");
  await page.getByLabel("Estoque").fill("4");
  // PNG 1×1, enviado junto com o cadastro
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await page.locator("input[name=fotos]").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Salvar produto" }).click();
  await expect(page.getByText("Produto salvo.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fotos" })).toBeVisible();

  await page.goto("/loja/infinite/busca?q=tornozeleira");
  const foto = page.getByRole("img", { name: "Tornozeleira Estrela" });
  await expect(foto).toBeVisible();
  const src = await foto.getAttribute("src");
  const resp = await page.request.get(src!);
  expect(resp.headers()["content-type"]).toBe("image/png");

  // com foto, o produto entra no feed do Google/Instagram
  const feed = await page.request.get("/loja/infinite/feed.xml");
  expect(feed.status()).toBe(200);
  expect(await feed.text()).toContain("<g:title>Tornozeleira Estrela</g:title>");
});

test("BG Imports: abertura de relojoaria e desconto no Pix no pedido", async ({ page }) => {
  await page.goto("/loja/bg-imports");
  await expect(page.getByRole("heading", { level: 1, name: "BG Atlântico" })).toBeVisible();
  await expect(page.getByText("5% off no Pix").first()).toBeVisible();
  // menu em tela cheia com as coleções
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "Relógios" })).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();
  await page.getByRole("link", { name: "Descobrir", exact: true }).click();
  await expect(page.getByText("no Pix (5% de desconto)")).toBeVisible();
  await expect(page.getByText("Ficha técnica")).toBeVisible();
  await page.getByRole("button", { name: "Adicionar à sacola" }).click();
  await expect(page.getByText("Adicionado à sacola.")).toBeVisible();
  await page.goto("/loja/bg-imports/checkout");
  await page.getByRole("textbox", { name: "Nome completo", exact: true }).fill("Carlos Teste");
  await page.getByRole("textbox", { name: "E-mail", exact: true }).fill("carlos@teste.com");
  await page.getByRole("textbox", { name: "WhatsApp", exact: true }).fill("(11) 97777-6666");
  await page.getByRole("radio", { name: /Retirar/ }).check();
  await page.getByRole("radio", { name: /Pix com 5% de desconto/ }).check();
  await expect(page.getByText("Desconto no Pix (5%)")).toBeVisible();
  await page.getByRole("button", { name: "Fechar pedido" }).click();
  await page.waitForURL(/\/pedido\/[A-Z0-9]+$/);
  // 259,99 − 5% (13,00) = 246,99
  await expect(page.getByText("Total: R$ 246,99")).toBeVisible();
});

test("painel enxuto: canais e abas", async ({ page }) => {
  await entrarNoPainel(page);
  await page.goto("/admin/canais");
  await expect(page.getByRole("heading", { name: "Canais de venda" })).toBeVisible();
  await expect(page.getByText("Feed de produtos (Merchant Center)")).toBeVisible();
  await page.goto("/admin/canais/mercadolivre");
  await expect(page.getByText("ML_CLIENT_ID")).toBeVisible();
  await page.goto("/admin/estoque");
  await expect(page.getByRole("link", { name: "Categorias" })).toBeVisible();
});

test("estoque esgotado não deixa comprar", async ({ page, request }) => {
  const r = await request.post("/api/loja/bg-imports/pedidos", {
    data: {
      cliente: { nome: "Teste", email: "t@t.com", telefone: "11999990000" },
      entrega: { metodo: "retirada" },
      itens: [{ varianteId: 999999, quantidade: 1 }],
      pagamento: "pix",
    },
  });
  expect(r.status()).toBe(409);
  expect((await r.json()).erro).toContain("não existe");
});

test("API da Kira exige token e devolve o resumo", async ({ request }) => {
  expect((await request.get("/api/kira/resumo")).status()).toBe(401);
  const r = await request.get("/api/kira/resumo", { headers: { Authorization: "Bearer token-de-teste-da-kira-123" } });
  expect(r.status()).toBe(200);
  const dados = await r.json();
  const infinite = dados.lojas.find((l: { loja: { slug: string } }) => l.loja.slug === "infinite");
  expect(infinite.mes.pedidos).toBe(2);
});

test("painel exige login", async ({ page }) => {
  await page.goto("/admin/pedidos");
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect((await page.request.get("/admin/exportar?tipo=pedidos")).status()).toBe(401);
});
