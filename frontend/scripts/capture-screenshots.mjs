import { chromium } from "playwright";

const baseUrl = "http://localhost:5173";
const outDir = "/Users/wangshiya/work_njc/cursor_workplace/cute_cat/artifacts/screenshots";

const files = {
  login: `${outDir}/frontend-login.png`,
  claim: `${outDir}/frontend-claim.png`,
  garden: `${outDir}/frontend-garden.png`,
  offlineToast: `${outDir}/frontend-offline-toast.png`,
};

const email = `visual_${Date.now()}@example.com`;
const password = "pass123456";
const nickname = "视觉联调";
const petName = "咪咪";

const result = {
  wsJoinPassed: false,
  actionDeltaPassed: false,
  usedOfflineModalForFourthShot: false,
  files,
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#auth-form");
  await page.screenshot({ path: files.login, fullPage: true });

  await page.click('[data-tab="register"]');
  await page.fill("#nickname", nickname);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("#auth-submit");

  await page.waitForSelector("#claim-form", { timeout: 15000 });
  await page.screenshot({ path: files.claim, fullPage: true });

  await page.fill("#petName", petName);
  await page.selectOption("#petType", "cat");
  await page.click("#claim-submit");

  const modal = await page.waitForSelector(".modal-backdrop", { timeout: 8000 }).catch(() => null);
  if (modal) {
    result.usedOfflineModalForFourthShot = true;
    await page.screenshot({ path: files.offlineToast, fullPage: true });
    await page.click("[data-dismiss]");
  }

  await page.waitForSelector("#game-mount", { timeout: 15000 });
  await page.waitForSelector(".ws-bar.connected", { timeout: 10000 });
  result.wsJoinPassed = true;
  await page.screenshot({ path: files.garden, fullPage: true });

  // Use a non-inventory action for stable regression signal.
  await page.click('[data-action="Cuddle"]');
  const toast = await page.waitForSelector(".toast", { timeout: 8000 }).catch(() => null);
  if (toast) {
    result.actionDeltaPassed = true;
    if (!result.usedOfflineModalForFourthShot) {
      await page.screenshot({ path: files.offlineToast, fullPage: true });
    }
  }
} finally {
  await context.close();
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
