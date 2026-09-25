import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://*.tile.openstreetmap.org/**", (route) => route.abort());
});

test("dashboard loads backend data and exposes the analysis year", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Pune water intelligence" })).toBeVisible();
  await expect(page.getByLabel("Analysis year")).toHaveValue("2025");
  await expect(page.getByLabel("Dataset provenance")).toContainText("AquaLink API");
  await expect(page.getByText("250 records analysed")).toBeVisible();
});

test("theme selection persists after reload", async ({ page }) => {
  await page.goto("/dashboard");
  await page.evaluate(() => localStorage.setItem("aqualink-theme", "dark"));
  await page.reload();
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("map filtering updates the visible marker result state", async ({ page }) => {
  await page.goto("/map");
  await expect(page.getByRole("heading", { name: "Pune water risk map" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search location" }).fill("no-such-aqualink-location");
  await expect(page.getByText("No matching locations")).toBeVisible();
  await expect(page.getByText("0 of 250 shown")).toBeVisible();
});

test("selecting a map marker opens history and score explanation", async ({ page }) => {
  await page.goto("/map");
  await expect(page.locator(".leaflet-interactive").first()).toBeVisible();
  await page.locator(".leaflet-interactive").first().click({ force: true });
  await expect(page.getByText("Selected location")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Location history" })).toBeVisible();
  await expect(page.getByText("Why this score?")).toBeVisible();
  await expect(page.getByText(/score confidence/)).toBeVisible();
});

test("forecast table matches the backend projection", async ({ page, request }) => {
  const response = await request.get("http://127.0.0.1:8000/api/forecast/district?district=Pune");
  expect(response.ok()).toBeTruthy();
  const backend = await response.json();
  const projection = backend.forecast_projected.at(-1);
  await page.goto("/forecast");
  await expect(page.getByRole("heading", { name: "Water stress forecast" })).toBeVisible();
  const row = page.getByRole("row", { name: new RegExp(`${projection.year} Forecast ${projection.projected_score.toFixed(1)}`) });
  await expect(row).toBeVisible();
  await expect(page.getByText(`${backend.supporting_record_count} supporting records`)).toBeVisible();
});

test("API failure activates the visible local fallback warning", async ({ page }) => {
  await page.route("http://127.0.0.1:8000/**", (route) => route.abort("failed"));
  await page.goto("/dashboard");
  await expect(page.getByRole("alert")).toContainText("Local fallback active");
  await expect(page.getByLabel("Dataset provenance")).toContainText("Bundled local CSV");
});
