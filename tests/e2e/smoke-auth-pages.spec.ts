import { test, expect } from "@playwright/test";

// Auth-required pages. Auth state is loaded from storageState set up by
// auth.setup.ts, so every test starts already logged in.
//
// What each test asserts:
//   1. The page renders without throwing (no Next.js error page)
//   2. The browser console has no error-level entries during the load
//   3. The expected anchor element (a heading, a key control) is visible

const AUTH_PAGES: Array<{
  name: string;
  path: string;
  expect: RegExp | string;
}> = [
  { name: "home dashboard", path: "/", expect: /Buenos|Buenas/ },
  { name: "today's workout", path: "/workout/today", expect: /Día de Hoy|Descanso|Gym|Cycling/i },
  { name: "week view", path: "/routine/week", expect: /semana/i },
  { name: "routine load", path: "/routine/load", expect: /cargar/i },
  { name: "routine generate", path: "/routine/generate", expect: /generar/i },
  { name: "routine pending", path: "/routine/pending", expect: /pendiente|aprob/i },
  { name: "metrics", path: "/metrics", expect: /m[ée]tricas/i },
  { name: "metrics records", path: "/metrics/records", expect: /r[eé]cord/i },
  { name: "nutrition", path: "/nutrition", expect: /nutrici[oó]n/i },
  { name: "wiki", path: "/wiki", expect: /ejercicios|wiki/i },
  { name: "help", path: "/help", expect: /ayuda|faq/i },
  { name: "profile", path: "/profile", expect: /perfil|datos|cuenta/i },
];

for (const view of AUTH_PAGES) {
  test(`smoke: ${view.name} (${view.path})`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    const response = await page.goto(view.path);
    expect(response, `${view.path} should respond`).not.toBeNull();
    expect(response!.status(), `${view.path} HTTP status`).toBeLessThan(400);

    // Reach a stable rendering point. We avoid networkidle (Strava can hang)
    // and instead wait for the DOM.
    await page.waitForLoadState("domcontentloaded");

    // Body content should reference the page's anchor copy. This catches an
    // unstyled page or a 404 disguised as 200 because the content is wrong.
    await expect(page.locator("body")).toContainText(view.expect, { timeout: 10_000 });

    // Hydration errors and runtime errors land in console as "error". We
    // allow a small allowlist of known Next/React noise (none currently).
    const significant = consoleErrors.filter(
      (e) =>
        !/Failed to load resource.*favicon/i.test(e) &&
        !/manifest\.webmanifest/i.test(e),
    );
    expect(significant, `console errors on ${view.path}`).toEqual([]);
  });
}
