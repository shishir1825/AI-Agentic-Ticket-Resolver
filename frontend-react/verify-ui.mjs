#!/usr/bin/env node
/**
 * UI Verification Script - Navigates to localhost:5173, verifies layout, takes screenshots
 * Run: npx playwright install chromium && node verify-ui.mjs
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE_URL = "http://localhost:5173";
const SCREENSHOT_DIR = join(process.cwd(), "verification-screenshots");

async function main() {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const consoleLogs = [];
  const consoleErrors = [];
  page.on("console", (msg) => {
    const text = msg.text();
    const type = msg.type();
    if (type === "error") consoleErrors.push(text);
    else consoleLogs.push(`[${type}] ${text}`);
  });

  const report = { passed: [], failed: [], screenshots: [], errors: [] };

  try {
    // 1. Home page
    await page.goto(BASE_URL + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    const hasSidebar = await page.locator("aside").count() > 0;
    const hasLogo = await page.locator("text=CRI Workflow").count() > 0;
    const hasRoleSwitcher = await page.locator("select").count() > 0;
    const hasNavLinks = await page.locator('nav a[href="/"]').count() > 0;
    const hasUploadLink = await page.locator('a[href="/upload"]').count() > 0;
    const hasJiraLink = await page.locator('a[href="/jira-board"]').count() > 0;
    const hasHero = await page.locator("text=CRI Workflow Engine").count() > 0;
    const hasMetrics = await page.locator("text=Total Runs").count() > 0;
    const hasHowItWorks = await page.locator("text=How It Works").count() > 0;

    report.passed.push(hasSidebar && "Sidebar present");
    report.passed.push(hasLogo && "CRI Workflow logo");
    report.passed.push(hasRoleSwitcher && "Role switcher dropdown");
    report.passed.push(hasNavLinks && "Navigation links");
    report.passed.push(hasHero && "Hero card 'CRI Workflow Engine'");
    report.passed.push(hasMetrics && "Metric cards");
    report.passed.push(hasHowItWorks && "How It Works pipeline");

    if (!hasSidebar) report.failed.push("Sidebar not found");
    if (!hasLogo) report.failed.push("CRI Workflow logo not found");

    await page.screenshot({ path: join(SCREENSHOT_DIR, "01-home.png") });
    report.screenshots.push("01-home.png");

    // 2. Upload page
    await page.click('a[href="/upload"]');
    await page.waitForURL("**/upload");
    await page.waitForTimeout(300);

    const hasDropzone = await page.locator("text=Drag & drop").count() > 0 || 
      await page.locator("text=click to select").count() > 0;
    const hasUploadTitle = await page.locator("text=Upload Document").count() > 0;

    report.passed.push(hasDropzone && "Upload drag-and-drop zone");
    report.passed.push(hasUploadTitle && "Upload page title");
    if (!hasDropzone) report.failed.push("Upload dropzone not found");

    await page.screenshot({ path: join(SCREENSHOT_DIR, "02-upload.png") });
    report.screenshots.push("02-upload.png");

    // 3. JIRA Board page
    await page.click('a[href="/jira-board"]');
    await page.waitForURL("**/jira-board");
    await page.waitForTimeout(300);

    const hasTabs = await page.locator('[role="tablist"]').count() > 0 || 
      await page.locator("text=Workflow JIRAs").count() > 0;
    const hasJiraTitle = await page.locator("text=JIRA Board").count() > 0;

    report.passed.push(hasTabs && "JIRA Board tabs");
    report.passed.push(hasJiraTitle && "JIRA Board title");
    if (!hasTabs) report.failed.push("JIRA Board tabs not found");

    await page.screenshot({ path: join(SCREENSHOT_DIR, "03-jira-board.png") });
    report.screenshots.push("03-jira-board.png");

    // 4. Back to Home
    await page.click('a[href="/"]');
    await page.waitForURL("**/");
    await page.waitForTimeout(300);

    const backToHome = await page.locator("text=CRI Workflow Engine").count() > 0;
    report.passed.push(backToHome && "Home navigation works");

    await page.screenshot({ path: join(SCREENSHOT_DIR, "04-home-again.png") });
    report.screenshots.push("04-home-again.png");

    report.errors = consoleErrors;
  } catch (err) {
    report.errors.push(String(err));
  } finally {
    await browser.close();
  }

  // Output report
  const output = {
    summary: {
      passed: report.passed.filter(Boolean).length,
      failed: report.failed.length,
      consoleErrors: report.errors.length,
    },
    passed: report.passed.filter(Boolean),
    failed: report.failed,
    consoleErrors: report.errors,
    screenshots: report.screenshots,
  };

  writeFileSync(join(SCREENSHOT_DIR, "report.json"), JSON.stringify(output, null, 2));
  console.log("\n=== UI Verification Report ===\n");
  console.log("Passed:", output.passed.join(", "));
  if (output.failed.length) console.log("Failed:", output.failed.join(", "));
  if (output.consoleErrors.length) console.log("Console errors:", output.consoleErrors);
  console.log("\nScreenshots saved to:", SCREENSHOT_DIR);
  console.log(JSON.stringify(output, null, 2));
}

main().catch(console.error);
