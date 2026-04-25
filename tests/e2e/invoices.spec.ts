import { test, expect } from "@playwright/test";

async function isSignedIn(page: import("@playwright/test").Page): Promise<boolean> {
  await page.waitForTimeout(1000);
  const signIn = page.getByRole("heading", { name: "Sign in" });
  return !(await signIn.isVisible().catch(() => false));
}

// --- Smoke ---

test.describe("Invoices — Smoke", () => {
  test("invoices route loads without 404", async ({ page }) => {
    await page.goto("/invoices");
    await expect(
      page.getByRole("heading", { name: "Sign in" }).or(page.getByRole("heading", { name: "Create Invoice" }))
    ).toBeVisible({ timeout: 15000 });
  });

  test("work summary API keeps Groq behind authentication", async ({ request }) => {
    const response = await request.post("/api/invoices/work-summary", {
      data: {
        entries: [
          {
            id: "entry-1",
            description: "Build invoice summary",
            projectName: "BogglTrack",
            commits: [
              {
                sha: "abc123456789",
                message: "Add invoice summary",
                repo: "burhankhatri/BogglTrack",
              },
            ],
          },
        ],
      },
    });

    expect(response.status()).toBe(401);
  });
});

// --- Desktop Tests ---

test.describe("Invoices — Desktop (1280px)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // Scenario 1: Uninvoiced-only filter (default on)
  test("uninvoiced-only toggle is checked by default", async ({ page }) => {
    await page.goto("/invoices", { waitUntil: "networkidle" });
    if (!(await isSignedIn(page))) {
      test.skip(true, "Not authenticated");
      return;
    }

    // The uninvoiced-only checkbox should be checked
    const checkbox = page.locator("[data-testid='uninvoiced-toggle'] input[type='checkbox']");
    await expect(checkbox).toBeChecked();
  });

  // Scenario 7: Checkbox entry selection — filters and select-all visible
  test("step 1 has filter controls and select-all checkbox", async ({ page }) => {
    await page.goto("/invoices", { waitUntil: "networkidle" });
    if (!(await isSignedIn(page))) {
      test.skip(true, "Not authenticated");
      return;
    }

    await expect(page.getByRole("heading", { name: "Create Invoice" })).toBeVisible();

    // Filter buttons visible
    await expect(page.getByRole("button", { name: /All Projects/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /All Clients/ })).toBeVisible();
    await expect(page.getByText("Uninvoiced only")).toBeVisible();

    // Select-all checkbox
    await expect(page.locator("[data-testid='select-all']")).toBeVisible();
  });

  // Scenario 3: Continue button or empty state present
  test("shows entries or empty state message", async ({ page }) => {
    await page.goto("/invoices", { waitUntil: "networkidle" });
    if (!(await isSignedIn(page))) {
      test.skip(true, "Not authenticated");
      return;
    }

    // Either entries with Continue button, or empty state message
    await expect(
      page.getByRole("button", { name: /Continue/ })
        .or(page.getByText("No billable entries found"))
    ).toBeVisible({ timeout: 10000 });
  });

  // Step indicators
  test("3-step indicators are displayed", async ({ page }) => {
    await page.goto("/invoices", { waitUntil: "networkidle" });
    if (!(await isSignedIn(page))) {
      test.skip(true, "Not authenticated");
      return;
    }

    // All 3 step numbers visible
    for (const num of ["1", "2", "3"]) {
      const step = page.locator(".rounded-full").filter({ hasText: new RegExp(`^${num}$`) }).first();
      await expect(step).toBeVisible();
    }
  });

  // Sidebar nav item
  test("invoices link appears in sidebar", async ({ page }) => {
    await page.goto("/invoices", { waitUntil: "networkidle" });
    if (!(await isSignedIn(page))) {
      test.skip(true, "Not authenticated");
      return;
    }

    await expect(page.getByRole("link", { name: "Invoices" })).toBeVisible();
  });

  // Table headers for entries
  test("entry table has correct column headers", async ({ page }) => {
    await page.goto("/invoices", { waitUntil: "networkidle" });
    if (!(await isSignedIn(page))) {
      test.skip(true, "Not authenticated");
      return;
    }

    // Table headers
    await expect(page.getByRole("columnheader", { name: "Date" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Description" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Project" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Duration" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Rate" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Amount" })).toBeVisible();
  });

  // Date filter dropdown
  test("date range filter opens with options", async ({ page }) => {
    await page.goto("/invoices", { waitUntil: "networkidle" });
    if (!(await isSignedIn(page))) {
      test.skip(true, "Not authenticated");
      return;
    }

    // Find and click the date range select trigger (it's a button in the Select)
    const trigger = page.locator("button").filter({ hasText: /this-month|This Month/ }).first();
    await trigger.click();
    await page.waitForTimeout(300);

    // Dropdown options should appear
    await expect(page.getByText("All Time")).toBeVisible();
    await expect(page.getByText("This Week")).toBeVisible();
    await expect(page.getByText("Last 30 Days")).toBeVisible();
  });
});

// --- Mobile ---

test.describe("Invoices — Mobile (375px)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("invoice page loads on mobile with filters", async ({ page }) => {
    await page.goto("/invoices", { waitUntil: "networkidle" });
    if (!(await isSignedIn(page))) {
      test.skip(true, "Not authenticated");
      return;
    }

    await expect(page.getByRole("heading", { name: "Create Invoice" })).toBeVisible();
    await expect(page.getByText("Uninvoiced only")).toBeVisible();
  });
});
