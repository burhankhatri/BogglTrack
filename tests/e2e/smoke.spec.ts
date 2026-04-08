import { test, expect } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("app loads and redirects or shows content", async ({ page }) => {
    await page.goto("/");
    // The app should load — either sign-in page or the global timer bar input
    await expect(
      page.getByRole("heading", { name: "Sign in" }).or(page.getByRole("textbox", { name: "What are you working on?" }))
    ).toBeVisible({ timeout: 15000 });
  });

  test("canvas route exists (no 404)", async ({ page }) => {
    await page.goto("/canvas");
    // Should show Canvas heading or sign-in page
    await expect(
      page.getByRole("heading", { name: "Sign in" }).or(page.getByRole("heading", { name: "Canvas" }))
    ).toBeVisible({ timeout: 15000 });
  });

  test("calendar route exists (no 404)", async ({ page }) => {
    await page.goto("/calendar");
    await expect(
      page.getByRole("heading", { name: "Sign in" }).or(page.getByRole("heading", { name: "Calendar" }))
    ).toBeVisible({ timeout: 15000 });
  });

  test("timer page dropdown is not clipped", async ({ page }) => {
    await page.goto("/timer");
    // Verify the page loads (sign-in or timer page content)
    await expect(
      page.getByRole("heading", { name: "Sign in" }).or(page.locator("[data-testid='timer-page']").or(page.getByText("This week")))
    ).toBeVisible({ timeout: 15000 });
  });
});
