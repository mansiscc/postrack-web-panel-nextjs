import { mkdir } from "fs/promises";
import path from "path";

import { test as setup, expect } from "@playwright/test";

const authFile = path.join("tests/e2e/.auth/user.json");
const email = process.env.PLAYWRIGHT_TEST_EMAIL;
const password = process.env.PLAYWRIGHT_TEST_PASSWORD;

setup("authenticate test user", async ({ page }) => {
  if (!email || !password) {
    setup.skip();
    return;
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).not.toHaveURL(/\/login/);
  await mkdir(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
