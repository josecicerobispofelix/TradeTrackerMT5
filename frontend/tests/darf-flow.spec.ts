import { test, expect } from "@playwright/test";

const RUN_E2E = process.env.RUN_E2E === "1";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://127.0.0.1:5173";
const USER_EMAIL = process.env.USER_EMAIL || "ciceroforex@gmail.com";
const USER_PASSWORD = process.env.USER_PASSWORD || "123456";

const e2e = RUN_E2E ? test : test.skip;

e2e("login e seção DARF visível", async ({ page }) => {
  await page.goto(FRONTEND_URL, { waitUntil: "domcontentloaded" });

  // Se precisar de login, preenche e entra
  const loginHeader = page.getByText(/Login obrigat[oó]rio/i);
  if (await loginHeader.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.getByLabel(/E-mail/i).fill(USER_EMAIL);
    const senhaField = page.getByLabel(/^Senha$/i);
    await senhaField.fill(USER_PASSWORD);
    await page.getByRole("button", { name: /^Entrar$/i }).click();
  }

  // Espera dashboard carregar
  await expect(page.getByText(/SUA PERFORMANCE/i)).toBeVisible({ timeout: 15000 });

  // Checa seção DARF
  await expect(page.getByText(/DARF \/ Imposto/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Gerar PDF/i })).toBeVisible();
});
