import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test("renders sign-in form", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: /sign in to postrack/i }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  test("shows validation for empty submit", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByLabel("Email")).toBeVisible();
  });
});
