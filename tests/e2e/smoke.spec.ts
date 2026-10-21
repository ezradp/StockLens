import { expect, test } from "@playwright/test";

test("shell aplikasi tampil dengan nav 10 menu", async ({ page }) => {
  await page.goto("/overview");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toBeVisible();
  for (const label of [
    "Stock Explorer",
    "Screener",
    "Portfolio",
    "DCF Valuation",
    "Data Import",
  ]) {
    await expect(page.getByRole("link", { name: label })).toBeVisible();
  }
});
