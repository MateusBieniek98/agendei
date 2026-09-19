import { expect, test } from "@playwright/test";

test("health check exposes only operational metadata", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);

  const body = await response.json();
  expect(body).toMatchObject({ ok: true, service: "Talhivo" });
  expect(body.timestamp).toEqual(expect.any(String));
  expect(Object.keys(body).sort()).toEqual(["ok", "service", "timestamp"]);
});

test("login remains accessible and usable without customer data", async ({ page }) => {
  await page.goto("/login");
  const password = page.locator("#login-password");

  await expect(
    page.getByRole("heading", { level: 1, name: "Entre na sua conta" }),
  ).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(password).toHaveAttribute("type", "password");

  await page.getByRole("button", { name: "Mostrar senha" }).click();
  await expect(password).toHaveAttribute("type", "text");
});
