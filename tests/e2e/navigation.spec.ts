import { test, expect } from "@playwright/test";

// Navigation flows from the home dashboard via the visible nav cards.
// Each card is a Link on the home grid (see src/app/page.tsx dashboardCards),
// so clicking the card title should land on the expected URL.

const NAV_FROM_HOME: Array<{ label: RegExp; expectedPath: string; expectText: RegExp }> = [
  { label: /generar con ia/i, expectedPath: "/routine/generate", expectText: /generar/i },
  { label: /toda la semana/i, expectedPath: "/routine/week", expectText: /semana/i },
  { label: /m[eé]tricas/i, expectedPath: "/metrics", expectText: /m[ée]tricas/i },
  { label: /cargar json/i, expectedPath: "/routine/load", expectText: /cargar/i },
  { label: /ayuda/i, expectedPath: "/help", expectText: /ayuda|faq/i },
  { label: /nutrici[oó]n bici/i, expectedPath: "/nutrition", expectText: /nutrici[oó]n/i },
  { label: /wiki de ejercicios/i, expectedPath: "/wiki", expectText: /ejercicios|wiki/i },
];

for (const nav of NAV_FROM_HOME) {
  test(`nav: home → ${nav.expectedPath}`, async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: nav.label }).first().click();
    await page.waitForURL(`**${nav.expectedPath}`, { timeout: 15_000 });
    await expect(page.locator("body")).toContainText(nav.expectText, { timeout: 10_000 });
  });
}

test("nav: home → entrenamiento de hoy (featured card)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /entrenamiento de hoy/i }).click();
  await page.waitForURL("**/workout/today", { timeout: 15_000 });
});

test("nav: back link returns to home from /metrics", async ({ page }) => {
  await page.goto("/metrics");
  await page.getByRole("link", { name: /volver/i }).first().click();
  await page.waitForURL("/", { timeout: 10_000 });
});
