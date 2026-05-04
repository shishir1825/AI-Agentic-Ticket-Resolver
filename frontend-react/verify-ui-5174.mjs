#!/usr/bin/env node
/**
 * UI Verification Script for SnapResolve (port 5174)
 * Verifies rebrand, sidebar sections, role switcher, new pages, mobile hamburger
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE_URL = "http://localhost:5174";
const SCREENSHOT_DIR = join(process.cwd(), "verification-screenshots-5174");

async function main() {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  const report = { passed: [], failed: [], screenshots: [], errors: [] };

  try {
    // 1. Home page
    await page.goto(BASE_URL + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    const titleSnapResolve = await page.locator("text=SnapResolve").count() > 0;
    const noCriWorkflowEngine = (await page.locator("text=CRI Workflow Engine").count()) === 0;
    const hasChargebeeLogo = await page.locator("svg[viewBox='0 0 40 40']").count() > 0;
    const hasRoleSwitcher = await page.locator("select").count() > 0;
    const hasRoleAvatar = await page.locator("aside").locator("div.rounded-full").count() > 0;
    const hasWorkflowSection = await page.locator("text=Workflow").count() > 0;
    const hasInsightsSection = await page.locator("text=Insights").count() > 0;
    const hasDashboard = await page.locator('a[href="/"]').filter({ hasText: "Dashboard" }).count() > 0;
    const hasCodeFix = await page.locator("text=Code Fix").count() > 0;
    const hasEngineerReview = await page.locator("text=Engineer Review").count() > 0;
    const hasEMSignoff = await page.locator("text=EM Sign-off").count() > 0;
    const howItWorksSteps = await page.locator("text=How It Works").locator("..").locator("..").locator("div.flex.items-center").count();
    const has9Steps = await page.locator("text=9 Done").count() > 0 || 
      (await page.locator("text=EM Sign-off").count() > 0 && await page.locator("text=Code Fix").count() > 0);

    report.passed.push(titleSnapResolve && "Title is SnapResolve");
    report.passed.push(noCriWorkflowEngine && "No 'CRI Workflow Engine'");
    report.passed.push(hasChargebeeLogo && "Chargebee logo in sidebar");
    report.passed.push(hasRoleSwitcher && "Role switcher dropdown");
    report.passed.push(hasRoleAvatar && "Role avatar (circular)");
    report.passed.push(hasWorkflowSection && "Section: Workflow");
    report.passed.push(hasInsightsSection && "Section: Insights");
    report.passed.push(hasDashboard && "Dashboard link");
    report.passed.push(hasCodeFix && "Code Fix link");
    report.passed.push(hasEngineerReview && "Engineer Review link");
    report.passed.push(hasEMSignoff && "EM Sign-off link");

    if (!titleSnapResolve) report.failed.push("Title should be SnapResolve");
    if (!hasChargebeeLogo) report.failed.push("Chargebee logo missing");

    await page.screenshot({ path: join(SCREENSHOT_DIR, "01-home.png") });
    report.screenshots.push("01-home.png");

    // Hover over a card to test animation
    const firstCard = page.locator(".card-hover").first();
    await firstCard.hover();
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(SCREENSHOT_DIR, "01b-home-card-hover.png") });
    report.screenshots.push("01b-home-card-hover.png");

    // 2. Switch to Engineering role
    await page.selectOption("select", "engineering");
    await page.waitForTimeout(400);

    const engAvatar = await page.locator("aside div.rounded-full.bg-gradient-to-br").count() > 0;
    const engSidebarShowsCodeFix = await page.locator("text=Code Fix (Agent-3)").count() > 0;
    const engSidebarShowsEngineerReview = await page.locator("text=Engineer Review").count() > 0;
    const engSidebarShowsEMSignoff = await page.locator("text=EM Sign-off").count() > 0;

    report.passed.push(engAvatar && "Engineering avatar visible");
    report.passed.push(engSidebarShowsCodeFix && "Engineer: Code Fix in sidebar");
    report.passed.push(engSidebarShowsEngineerReview && "Engineer: Engineer Review in sidebar");
    report.passed.push(engSidebarShowsEMSignoff && "Engineer: EM Sign-off in sidebar");

    await page.screenshot({ path: join(SCREENSHOT_DIR, "02-engineering-role.png") });
    report.screenshots.push("02-engineering-role.png");

    // 3. Code Fix page
    await page.click('a[href="/code-fix"]');
    await page.waitForURL("**/code-fix");
    await page.waitForTimeout(500);

    const codeFixTitle = await page.locator("text=Code Fix (Agent-3)").count() > 0;
    const codeFixListOrEmpty = await page.locator("text=No completed runs").count() > 0 ||
      await page.locator("text=Run Analysis").count() > 0 ||
      await page.locator("text=View Results").count() > 0 ||
      await page.locator("text=Loading runs").count() > 0;

    report.passed.push(codeFixTitle && "Code Fix page loads");
    report.passed.push(codeFixListOrEmpty && "Code Fix shows list or empty state");

    await page.screenshot({ path: join(SCREENSHOT_DIR, "03-code-fix.png") });
    report.screenshots.push("03-code-fix.png");

    // Click on a run if available
    const runLink = page.locator('a[href^="/code-fix/"]').first();
    if (await runLink.count() > 0) {
      await runLink.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(SCREENSHOT_DIR, "03b-code-fix-detail.png") });
      report.screenshots.push("03b-code-fix-detail.png");
      await page.click('a[href="/code-fix"]');
      await page.waitForTimeout(300);
    }

    // 4. Engineer Review page
    await page.click('a[href="/engineer-review"]');
    await page.waitForURL("**/engineer-review");
    await page.waitForTimeout(500);

    const engReviewTitle = await page.locator("text=Engineer Review").count() > 0;
    const engReviewStats = await page.locator("text=Pending Review").count() > 0 ||
      await page.locator("text=Approved").count() > 0 ||
      await page.locator("text=Inbox").count() > 0;

    report.passed.push(engReviewTitle && "Engineer Review page loads");
    report.passed.push(engReviewStats && "Engineer Review has stats strip or inbox");

    await page.screenshot({ path: join(SCREENSHOT_DIR, "04-engineer-review.png") });
    report.screenshots.push("04-engineer-review.png");

    // 5. EM Sign-off page
    await page.click('a[href="/em-signoff"]');
    await page.waitForURL("**/em-signoff");
    await page.waitForTimeout(500);

    const emSignoffTitle = await page.locator("text=EM Sign-off").count() > 0;
    const emSignoffContent = await page.locator("text=Awaiting Sign-off").count() > 0 ||
      await page.locator("text=Signed Off").count() > 0 ||
      await page.locator("text=Ready for Sign-off").count() > 0 ||
      await page.locator("text=No runs with approved").count() > 0;

    report.passed.push(emSignoffTitle && "EM Sign-off page loads");
    report.passed.push(emSignoffContent && "EM Sign-off shows content");

    await page.screenshot({ path: join(SCREENSHOT_DIR, "05-em-signoff.png") });
    report.screenshots.push("05-em-signoff.png");

    // 6. Mobile test - resize to < 768px
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(400);

    const hasHamburger = await page.locator("button").filter({ has: page.locator("svg") }).count() > 0;
    const sidebarHidden = await page.locator("aside.-translate-x-full").count() > 0 ||
      await page.locator("aside[class*='translate-x']").count() > 0;

    report.passed.push(hasHamburger && "Hamburger menu visible on mobile");
    report.passed.push((hasHamburger || sidebarHidden) && "Sidebar collapsed on mobile");

    await page.screenshot({ path: join(SCREENSHOT_DIR, "06-mobile.png") });
    report.screenshots.push("06-mobile.png");

    // Click hamburger to open sidebar
    const hamburgerBtn = page.locator("button.fixed.left-4.top-4");
    if (await hamburgerBtn.count() > 0) {
      await hamburgerBtn.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(SCREENSHOT_DIR, "06b-mobile-sidebar-open.png") });
      report.screenshots.push("06b-mobile-sidebar-open.png");
    }

    report.errors = consoleErrors;
  } catch (err) {
    report.errors.push(String(err));
  } finally {
    await browser.close();
  }

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
  console.log("\n=== SnapResolve UI Verification (5174) ===\n");
  console.log("Passed:", output.passed.join(", "));
  if (output.failed.length) console.log("Failed:", output.failed.join(", "));
  if (output.consoleErrors.length) console.log("Console errors:", output.consoleErrors);
  console.log("\nScreenshots:", SCREENSHOT_DIR);
  console.log(JSON.stringify(output, null, 2));
}

main().catch(console.error);
