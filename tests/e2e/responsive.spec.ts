import { test, expect } from "@playwright/test";

// Helper to check if we're on sign-in (unauthenticated) — skip viewport checks if so
async function isSignedIn(page: import("@playwright/test").Page): Promise<boolean> {
  const signIn = page.getByRole("heading", { name: "Sign in" });
  return !(await signIn.isVisible().catch(() => false));
}

test.describe("Calendar — Desktop (1280px)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("calendar renders with two-column grid layout", async ({ page }) => {
    await page.goto("/calendar", { waitUntil: "networkidle" });
    if (!(await isSignedIn(page))) {
      test.skip(true, "Not authenticated — skipping viewport test");
      return;
    }

    // Calendar heading visible
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();

    // The calendar date picker should be visible
    await expect(page.locator("table").first()).toBeVisible();

    // Day summary card should be visible
    await expect(page.getByText(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/)).toBeVisible();

    // Desktop sidebar should be visible
    await expect(page.locator("aside")).toBeVisible();

    // Mobile tab bar should be hidden
    await expect(page.locator("text=Home").locator("xpath=ancestor::div[contains(@class, 'md:hidden')]")).toBeHidden();
  });
});

test.describe("Calendar — Mobile (375px)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("calendar renders full-width on mobile", async ({ page }) => {
    await page.goto("/calendar", { waitUntil: "networkidle" });
    if (!(await isSignedIn(page))) {
      test.skip(true, "Not authenticated — skipping viewport test");
      return;
    }

    // Calendar heading visible
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();

    // Calendar date picker table should be visible and fit the screen
    const table = page.locator("table").first();
    await expect(table).toBeVisible();
    const tableBox = await table.boundingBox();
    expect(tableBox).not.toBeNull();
    // Table should not overflow the viewport width
    expect(tableBox!.x).toBeGreaterThanOrEqual(0);
    expect(tableBox!.x + tableBox!.width).toBeLessThanOrEqual(375 + 5); // 5px tolerance

    // Desktop sidebar should be hidden on mobile
    await expect(page.locator("aside")).toBeHidden();

    // Mobile tab bar should be visible
    const tabBar = page.locator("nav, div").filter({ hasText: "Home" }).filter({ hasText: "Calendar" });
    await expect(tabBar.first()).toBeVisible();
  });

  test("calendar day cells render and are tappable on mobile", async ({ page }) => {
    await page.goto("/calendar", { waitUntil: "networkidle" });
    if (!(await isSignedIn(page))) {
      test.skip(true, "Not authenticated — skipping viewport test");
      return;
    }

    // Find day buttons in the calendar — they should exist and be visible
    const dayButtons = page.locator("table button");
    const count = await dayButtons.count();
    expect(count).toBeGreaterThan(0);

    // First day button should be visible and have a reasonable tap target
    const firstDay = dayButtons.first();
    await expect(firstDay).toBeVisible();
    const box = await firstDay.boundingBox();
    expect(box).not.toBeNull();
    // Must be at least 16px wide to be tappable
    expect(box!.width).toBeGreaterThanOrEqual(16);
    expect(box!.height).toBeGreaterThanOrEqual(16);
  });
});

test.describe("Timer — Dropdown visibility", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("entry list card does not clip content with overflow-hidden", async ({ page }) => {
    await page.goto("/timer", { waitUntil: "networkidle" });
    if (!(await isSignedIn(page))) {
      test.skip(true, "Not authenticated — skipping viewport test");
      return;
    }

    // Wait for entries to load
    await page.waitForTimeout(2000);

    // Find entry list cards — they should NOT have overflow-hidden
    const entryCards = page.locator("[class*='rounded-'][class*='shadow-']").filter({ hasText: /(No description)|[a-zA-Z]/ });
    const count = await entryCards.count();

    if (count > 0) {
      for (let i = 0; i < Math.min(count, 3); i++) {
        const card = entryCards.nth(i);
        const classes = await card.getAttribute("class");
        // The card should NOT have overflow-hidden (we removed it)
        if (classes && classes.includes("flex flex-col")) {
          // This is the inner wrapper, check parent
          continue;
        }
        if (classes) {
          expect(classes).not.toContain("overflow-hidden");
        }
      }
    }
  });
});

test.describe("Canvas — Desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("canvas page loads with React Flow container", async ({ page }) => {
    await page.goto("/canvas", { waitUntil: "networkidle" });
    if (!(await isSignedIn(page))) {
      test.skip(true, "Not authenticated — skipping viewport test");
      return;
    }

    // Canvas heading
    await expect(page.getByRole("heading", { name: "Canvas" })).toBeVisible();

    // Instructions text
    await expect(page.getByText("Drag between nodes to link")).toBeVisible();

    // React Flow container should be present
    await expect(page.locator(".react-flow")).toBeVisible();
  });
});

test.describe("Canvas — Mobile (375px)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("canvas page is accessible on mobile", async ({ page }) => {
    await page.goto("/canvas", { waitUntil: "networkidle" });
    if (!(await isSignedIn(page))) {
      test.skip(true, "Not authenticated — skipping viewport test");
      return;
    }

    await expect(page.getByRole("heading", { name: "Canvas" })).toBeVisible();
    // React Flow should still render on mobile
    await expect(page.locator(".react-flow")).toBeVisible();
  });
});
