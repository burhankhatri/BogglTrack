import { test, expect } from "@playwright/test";

async function isSignedIn(page: import("@playwright/test").Page): Promise<boolean> {
  await page.waitForTimeout(1000);
  const signIn = page.getByRole("heading", { name: "Sign in" });
  return !(await signIn.isVisible().catch(() => false));
}

test.describe("Reports — Smoke", () => {
  test("reports route loads without 404", async ({ page }) => {
    await page.goto("/reports");
    await expect(
      page.getByRole("heading", { name: "Sign in" }).or(page.getByRole("heading", { name: "Reports" }))
    ).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Reports — Desktop (1280px)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("reports page has two-panel layout with insights sidebar", async ({ page }) => {
    await page.goto("/reports", { waitUntil: "networkidle" });
    if (!(await isSignedIn(page))) {
      test.skip(true, "Not authenticated — skipping layout test");
      return;
    }

    // Page heading
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();

    // Date range badge in header
    await expect(page.getByText("All Time").first()).toBeVisible();

    // Export buttons
    await expect(page.getByRole("button", { name: /CSV/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /PDF/ })).toBeVisible();

    // Insights sidebar should be visible on desktop (two instances in DOM: desktop + mobile)
    await expect(page.getByRole("heading", { name: "Insights" }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Work time").first()).toBeVisible();
  });

  test("filter bar has compact pill-style controls", async ({ page }) => {
    await page.goto("/reports", { waitUntil: "networkidle" });
    if (!(await isSignedIn(page))) {
      test.skip(true, "Not authenticated — skipping filter test");
      return;
    }

    // Project filter button
    await expect(page.getByRole("button", { name: /All Projects/ })).toBeVisible();

    // Client filter button
    await expect(page.getByRole("button", { name: /All Clients/ })).toBeVisible();
  });

  test("tabs are visible for switching views", async ({ page }) => {
    await page.goto("/reports", { waitUntil: "networkidle" });
    if (!(await isSignedIn(page))) {
      test.skip(true, "Not authenticated — skipping tab test");
      return;
    }

    await expect(page.getByText("Summary")).toBeVisible();
    await expect(page.getByText("Detailed")).toBeVisible();
    await expect(page.getByText("Weekly")).toBeVisible();
  });
});

test.describe("Reports — Mobile (375px)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("reports page loads on mobile", async ({ page }) => {
    await page.goto("/reports", { waitUntil: "networkidle" });
    if (!(await isSignedIn(page))) {
      test.skip(true, "Not authenticated — skipping mobile test");
      return;
    }

    // Page heading
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();

    // On mobile, the mobile insights panel should be visible (the lg:hidden one)
    // Use last() since on mobile the desktop one (first) is hidden
    await expect(page.getByRole("heading", { name: "Insights" }).last()).toBeVisible({ timeout: 10000 });
  });
});
