import { expect, test } from "@playwright/test";

// Dates are judged in the app timezone (default Asia/Kolkata), so build "tomorrow" the same way.
const TZ = process.env.E2E_TIMEZONE ?? "Asia/Kolkata";
function tomorrowIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(Date.now() + 24 * 3600_000));
}

test("create a lead, log a discussion with a follow-up, change status, and see it persist", async ({ page }) => {
  const name = `E2E Lead ${Date.now()}`;
  const note = `Intro call ${Date.now()}: they want a weekly review cadence.`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Leads", exact: true })).toBeVisible();

  // Add a lead (only the name is required; status defaults to New).
  await page.getByRole("button", { name: "Add lead" }).first().click();
  const addDialog = page.getByRole("dialog", { name: "Add lead" });
  await expect(addDialog.getByLabel("Status")).toHaveValue("New");
  await addDialog.getByLabel(/Full name/).fill(name);
  await addDialog.getByLabel(/Company/).fill("E2E Corp");
  await addDialog.getByRole("button", { name: "Add lead" }).click();

  // The new lead opens in the timeline dialog (no page navigation).
  const panel = page.getByRole("dialog").filter({ hasText: name });
  await expect(panel).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/");
  await expect(panel.getByText("No discussions yet")).toBeVisible();

  // Status change persists through the API.
  await panel.getByRole("combobox", { name: "Lead status" }).selectOption("Qualified");
  await expect(page.getByText("Status updated")).toBeVisible();

  // Log a discussion with a follow-up for tomorrow at 10:00.
  await panel.getByLabel("Log a discussion").fill(note);
  await panel.getByLabel(/Follow-up date/).fill(tomorrowIso());
  await panel.getByLabel(/Follow-up time/).fill("10:00");
  await panel.getByRole("button", { name: "Save discussion" }).click();

  const entry = panel.getByTestId("timeline-entry").first();
  await expect(entry).toContainText(note);
  await expect(entry).toContainText("Follow-up set for");
  await expect(panel.getByTestId("discussion-count")).toHaveText("1");

  // Close the dialog: the list row already reflects the new note, status and follow-up.
  await panel.getByRole("button", { name: "Close lead" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const row = page.getByRole("button", { name: new RegExp(`Open ${name}`) });
  await expect(row).toContainText(note);
  await expect(row.getByTestId("status-badge")).toHaveText("Qualified");
  await expect(row).toContainText("10:00 AM");

  // Reload and find it again with search + status filter: everything came from the database.
  await page.reload();
  await page.getByRole("searchbox").fill(name);
  await page.getByRole("button", { name: /^Qualified/ }).click();
  const persisted = page.getByRole("button", { name: new RegExp(`Open ${name}`) });
  await expect(persisted).toBeVisible();
  await expect(persisted).toContainText(note);
  await expect(page.getByRole("button", { name: /^New/ })).toBeVisible();

  // The reminder shows up under Upcoming.
  await page.getByRole("tab", { name: /Upcoming/ }).click();
  await expect(page.getByTestId("queue-row").filter({ hasText: name })).toBeVisible();
});

test("a blank lead name is blocked with a clear message", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add lead" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add lead" });
  await dialog.getByLabel(/Full name/).fill("   ");
  await dialog.getByRole("button", { name: "Add lead" }).click();
  await expect(dialog.getByText("Name is required", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("seeded overdue and due-today follow-ups are pinned above the lead list", async ({ page }) => {
  // Requires the demo seed: `python -m scripts.seed` in backend/.
  await page.goto("/");
  const rows = page.getByTestId("queue-row");
  await expect(rows.first()).toBeVisible();
  const states = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-state")));
  expect(states).toContain("overdue");
  expect(states).toContain("today");
  // Overdue reminders come before due-today ones.
  expect(states.indexOf("overdue")).toBeLessThan(states.indexOf("today"));
  await expect(page.getByText(/\d+ overdue/).first()).toBeVisible();
});
