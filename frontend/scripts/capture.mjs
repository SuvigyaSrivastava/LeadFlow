// Captures README screenshots and a short demo video from the RUNNING app.
// Prereqs: backend on :8000 (seeded), frontend on :3000.
//   PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome node scripts/capture.mjs
import { chromium } from "@playwright/test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const OUT = new URL("../../screenshots/", import.meta.url).pathname;
const TZ = process.env.E2E_TIMEZONE ?? "Asia/Kolkata";
const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(Date.now() + 864e5));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
});
const priya = (page) => page.getByRole("button", { name: "Open Priya Nair, Meridian Wealth Partners" });

// ---------------------------------------------------------------- desktop screenshots
{
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 })).newPage();
  await page.goto(BASE);
  await page.getByText("Priya Nair").first().waitFor();
  await page.screenshot({ path: join(OUT, "01-lead-list.png"), fullPage: true });
  await page.locator('section[aria-labelledby="queue-heading"]').screenshot({ path: join(OUT, "02-follow-up-queue.png") });

  await priya(page).click();
  await page.getByText("Discussion history").waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, "03-lead-timeline.png") });

  await page.getByRole("button", { name: "Prepare brief" }).click();
  const brief = page.getByTestId("brief-result");
  await brief.waitFor();
  await page.getByRole("heading", { name: "Prepare for next conversation" }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, "04-conversation-brief.png") });
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Add lead" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add lead" });
  await dialog.getByLabel(/Full name/).fill("Rohan Verma");
  await dialog.getByLabel(/Company/).fill("Vertex Advisory");
  await dialog.getByLabel(/Phone/).fill("+91 98111 22233");
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(OUT, "05-add-lead.png") });
  await page.close();
}

// ---------------------------------------------------------------- mobile screenshots
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.getByText("Priya Nair").first().waitFor();
  await page.screenshot({ path: join(OUT, "06-mobile-list.png") });
  await priya(page).click();
  await page.getByText("Discussion history").waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, "07-mobile-timeline.png") });
  await ctx.close();
}

// ---------------------------------------------------------------- demo video
{
  const tmp = join(OUT, ".video");
  rmSync(tmp, { recursive: true, force: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: tmp, size: { width: 1280, height: 800 } },
  });
  const page = await ctx.newPage();
  const pause = (ms = 900) => page.waitForTimeout(ms);
  await page.goto(BASE);
  await page.getByText("Priya Nair").first().waitFor();
  await pause(1800);

  // Filter and search
  await page.getByRole("button", { name: /^Contacted/ }).click();
  await pause();
  await page.getByRole("button", { name: /^All/ }).click();
  await page.getByRole("searchbox").pressSequentially("meera", { delay: 120 });
  await pause(1200);
  await page.getByRole("button", { name: "Clear search" }).click();
  await pause();

  // Open a lead, log a discussion with a follow-up
  await priya(page).click();
  await page.getByText("Discussion history").waitFor();
  await pause(1500);
  const panel = page.getByRole("dialog");
  await panel.getByLabel("Log a discussion").pressSequentially(
    "Spoke with Priya. Her partner approved the pricing. Wants a kickoff call.", { delay: 35 });
  await panel.getByLabel(/Follow-up date/).fill(tomorrow);
  await panel.getByLabel(/Follow-up time/).fill("11:00");
  await pause(700);
  await panel.getByLabel("Mark the due follow-up as done").check().catch(() => {});
  await panel.getByRole("button", { name: "Save discussion" }).click();
  await pause(1800);

  // Status change + brief
  await panel.getByRole("combobox", { name: "Lead status" }).selectOption("Won");
  await pause(1500);
  await panel.getByRole("button", { name: "Prepare brief" }).click();
  await page.getByTestId("brief-result").waitFor();
  await pause(2200);
  await panel.getByRole("button", { name: "Close lead" }).click();
  await pause(1500);

  // Add a lead
  await page.getByRole("button", { name: "Add lead" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add lead" });
  await dialog.getByLabel(/Full name/).pressSequentially("Rohan Verma", { delay: 60 });
  await dialog.getByLabel(/Company/).pressSequentially("Vertex Advisory", { delay: 60 });
  await pause(600);
  await dialog.getByRole("button", { name: "Add lead" }).click();
  await pause(2200);

  const video = page.video();
  await ctx.close();
  await video.saveAs(join(OUT, "demo.webm"));
  rmSync(tmp, { recursive: true, force: true });
}

await browser.close();
console.log("Saved screenshots and demo video to", OUT);
