import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/previa/gestao");
  await expect(page.getByRole("heading", { name: "Operações e faturamento" })).toBeVisible();
});

test("prévia filtra lançamentos sem consultar APIs operacionais", async ({ page }) => {
  const operationalRequests: string[] = [];
  page.on("request", (request) => { if (/\/api\/(dashboard|lancamentos|gestor|admin)/.test(request.url())) operationalRequests.push(request.url()); });
  await expect(page.getByText("Prévia · Dados fictícios", { exact: true })).toBeVisible();
  const realized = page.getByRole("button", { name: /^Realizado no período:/ });
  const original = await realized.textContent();
  await page.getByLabel("Fazenda", { exact: true }).selectOption("Fazenda Modelo A");
  await expect(realized).not.toHaveText(original!);
  await expect(page.getByRole("status")).toContainText("Recorte filtrado");
  await page.getByRole("button", { name: "Lançamentos", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("cell", { name: "Fazenda Modelo B", exact: false })).toHaveCount(0);
  await expect(dialog.getByRole("cell", { name: "Fazenda Modelo A", exact: false }).first()).toBeVisible();
  await dialog.getByRole("searchbox").fill("não existe nesta demonstração");
  await expect(dialog.getByText("Nenhum lançamento encontrado.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "CSV da seleção" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Lançamentos", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Limpar", exact: true }).click();
  await expect(realized).toHaveText(original!);
  expect(operationalRequests).toEqual([]);
});

test("pendências, simulação de meta e gráfico respondem à navegação", async ({ page }) => {
  await page.getByRole("button", { name: "Resumo SGF", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Pendências no SGF" })).toBeVisible();
  await expect(dialog.locator("tbody").getByText("Apontado", { exact: true })).toHaveCount(0);
  await expect(dialog.locator("tbody").getByText("Parcial", { exact: true }).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar detalhes" }).click();
  await page.getByRole("button", { name: "Simular meta" }).click();
  await dialog.getByLabel("Meta mensal (R$)").fill("500000");
  await dialog.getByRole("button", { name: "Aplicar na prévia" }).click();
  await expect(page.getByRole("region", { name: "Acompanhamento da meta" })).toContainText("500.000,00");
  await page.getByRole("button", { name: "Diário", exact: true }).click();
  await expect(page.getByRole("img", { name: /^Faturamento diário de demonstração/ })).toBeVisible();
  await page.getByRole("button", { name: "Área (ha)", exact: true }).click();
  await expect(page.getByRole("img", { name: /^Área realizada de demonstração/ })).toBeVisible();
  await page.getByRole("button", { name: "Apresentar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sair da apresentação" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Prévia · Dados fictícios", { exact: true })).toBeVisible();
});

test("exporta somente o recorte e alterna competências com datas coerentes", async ({ page }) => {
  await page.getByLabel("Fazenda", { exact: true }).selectOption("Fazenda Modelo B");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar CSV", exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("talhivo-demonstracao.csv");
  const stream = await download.createReadStream();
  let csv = "";
  for await (const chunk of stream!) csv += chunk.toString("utf8");
  expect(csv).toContain("Demonstração: dados fictícios");
  expect(csv).toContain("Fazenda Modelo B");
  expect(csv).not.toContain("Fazenda Modelo A");
  await page.getByLabel("Competência", { exact: true }).selectOption("2026-09");
  await expect(page.getByLabel("De", { exact: true })).toHaveValue("2026-09-01");
  await expect(page.getByLabel("Até", { exact: true })).toHaveValue("2026-09-28");
  await expect(page.getByLabel("Fazenda", { exact: true })).toHaveValue("");
});

test("celular mantém o conteúdo na largura da tela e lida com recorte vazio", async ({ page }) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel("De", { exact: true }).fill("2026-10-04");
  await page.getByLabel("Até", { exact: true }).fill("2026-10-04");
  await expect(page.getByText("Nenhum lançamento encontrado", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ver agenda", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Agenda de sobrevivência" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByLabel("De", { exact: true }).fill("2026-10-20");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("A data inicial deve ser anterior");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
