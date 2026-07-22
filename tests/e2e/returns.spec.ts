import { test, expect } from "@playwright/test";

const hasAuth = Boolean(
  process.env.PLAYWRIGHT_TEST_EMAIL && process.env.PLAYWRIGHT_TEST_PASSWORD,
);

test.describe("Sales returns", () => {
  test.skip(!hasAuth, "Requires PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD");

  test("loads sales history for return processing", async ({ page }) => {
    await page.goto("/sales");
    await expect(
      page.getByRole("heading", { name: "Sales history" }),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder("Search bill, customer, phone…"),
    ).toBeVisible();
  });
});
