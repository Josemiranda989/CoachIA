import { test, expect } from "@playwright/test";

// Public pages — no auth required. Run as the "public" project, which does
// NOT load the storageState fixture.

const PUBLIC_PAGES: Array<{
  name: string;
  path: string;
  expect: RegExp;
}> = [
  { name: "login", path: "/auth/login", expect: /iniciar sesi[oó]n/i },
  { name: "register", path: "/auth/register", expect: /registr/i },
  { name: "forgot password", path: "/auth/forgot-password", expect: /contrase/i },
  // Without a valid token, the page renders the "link inválido" fallback —
  // that's the correct render for a bare visit to the route.
  { name: "reset password", path: "/auth/reset-password", expect: /link inv[aá]lido|contrase|restable/i },
  { name: "privacy", path: "/privacy", expect: /privacidad|privacy/i },
  { name: "terms", path: "/terms", expect: /t[eé]rminos|terms/i },
];

for (const view of PUBLIC_PAGES) {
  test(`smoke: public ${view.name} (${view.path})`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    const response = await page.goto(view.path);
    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(400);

    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).toContainText(view.expect, { timeout: 10_000 });

    const significant = consoleErrors.filter(
      (e) =>
        !/Failed to load resource.*favicon/i.test(e) &&
        !/manifest\.webmanifest/i.test(e),
    );
    expect(significant).toEqual([]);
  });
}
