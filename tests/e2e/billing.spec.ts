import { test, expect } from "@playwright/test";

const hasAuth = Boolean(
  process.env.PLAYWRIGHT_TEST_EMAIL && process.env.PLAYWRIGHT_TEST_PASSWORD,
);

test.describe("POS billing", () => {
  test.skip(!hasAuth, "Requires PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD");

  test("loads billing workspace with empty cart", async ({ page }) => {
    await page.goto("/billing");

    await expect(
      page.getByRole("heading", { name: "POS Billing" }),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder("Search or scan barcode…"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Review & save" }),
    ).toBeDisabled();
    await expect(
      page.getByText("Add products from the catalog to start a bill."),
    ).toBeVisible();
  });

  test("enables save after adding a product from catalog", async ({ page }) => {
    await page.goto("/billing");

    const productButton = page
      .locator("button")
      .filter({ hasText: /₹|\d/ })
      .first();
    const hasProducts = (await productButton.count()) > 0;
    test.skip(!hasProducts, "No billable products in test tenant");

    await productButton.click();

    const batchDialog = page.getByRole("dialog");
    if (await batchDialog.isVisible()) {
      await page.getByRole("button", { name: /add|confirm|select/i }).first().click();
    }

    await expect(
      page.getByRole("button", { name: "Review & save" }),
    ).toBeEnabled();
  });
});
