import { test, expect } from "@playwright/test";

const hasAuth = Boolean(
  process.env.PLAYWRIGHT_TEST_EMAIL && process.env.PLAYWRIGHT_TEST_PASSWORD,
);

test.describe("Stock-in / purchases", () => {
  test.skip(!hasAuth, "Requires PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD");

  test("loads purchase list", async ({ page }) => {
    await page.goto("/purchases");
    await expect(page.getByRole("heading", { name: "Purchases" })).toBeVisible();
  });

  test("loads new purchase form", async ({ page }) => {
    await page.goto("/purchases/new");
    await expect(
      page.getByRole("heading", { name: "New purchase" }),
    ).toBeVisible();
  });
});
