import { test as setup, expect } from "@playwright/test";
import path from "node:path";

const STORAGE_STATE = path.join(__dirname, ".auth/user.json");

setup("authenticate", async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in the environment",
    );
  }

  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/contrase/i).fill(password);
  await page.getByRole("button", { name: /entrar al dashboard/i }).click();

  // After successful login, NextAuth redirects to /. The hero on / has the
  // greeting "Buenos|Buenas dias/tardes/noches, {name}.".
  await page.waitForURL("/", { timeout: 15_000 });
  await expect(page.locator("h1")).toContainText(/Buenos|Buenas/);

  await page.context().storageState({ path: STORAGE_STATE });
});
