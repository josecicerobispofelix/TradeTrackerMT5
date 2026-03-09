import { test, expect } from "@playwright/test";

const RUN_E2E = process.env.RUN_E2E === "1";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://127.0.0.1:5173";

const e2e = RUN_E2E ? test : test.skip;

e2e("abre dashboard e encontra a seção DARF", async ({ page }) => {
  await page.goto(FRONTEND_URL, { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/DARF/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Gerar PDF/i })).toBeVisible();
});
