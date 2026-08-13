/**
 * Browser verification pass.
 *
 * Screenshots every screen at phone, tablet and desktop widths, and asserts the two
 * mobile regressions that actually happen in practice:
 *   1. something wide forcing the whole page to scroll sideways, and
 *   2. tap targets smaller than the 44px minimum.
 *
 * Run against a preview server: `npm run build && npm run preview` then
 * `npx tsx scripts/verify-ui.ts [baseUrl]`.
 */

import { chromium, devices, type Page } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = resolve(HERE, '../.screenshots');
const BASE = process.argv[2] ?? 'http://localhost:4173/LotteryRandomizer/';

const VIEWPORTS = [
  { name: 'phone-360', width: 360, height: 640, mobile: true },
  { name: 'phone-390', width: 390, height: 844, mobile: true },
  { name: 'tablet-768', width: 768, height: 1024, mobile: true },
  { name: 'desktop-1280', width: 1280, height: 900, mobile: false },
];

const ROUTES = ['generate', 'observatory', 'vault'];
const MIN_TAP = 44;

let failures = 0;

function fail(msg: string) {
  failures++;
  console.error(`  FAIL ${msg}`);
}

async function checkNoHorizontalScroll(page: Page, where: string) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  // One pixel of slack for sub-pixel rounding.
  if (overflow.scrollWidth > overflow.clientWidth + 1) {
    fail(`${where}: page scrolls horizontally (${overflow.scrollWidth} > ${overflow.clientWidth})`);
  }
}

async function checkTapTargets(page: Page, where: string) {
  const small = await page.evaluate((min) => {
    const out: string[] = [];
    const nodes = document.querySelectorAll<HTMLElement>('button, a[href], input, [role="tab"]');
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      // Skip anything not actually rendered.
      if (r.width === 0 && r.height === 0) continue;
      if (getComputedStyle(el).visibility === 'hidden') continue;
      // WCAG 2.5.8 exempts targets sitting inline within a sentence.
      if (el.hasAttribute('data-inline-target')) continue;
      if (r.height < min - 0.5 || r.width < min - 0.5) {
        const name = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 30) || el.tagName;
        out.push(`${name} (${Math.round(r.width)}x${Math.round(r.height)})`);
      }
    }
    return out;
  }, MIN_TAP);

  for (const s of small) fail(`${where}: tap target under ${MIN_TAP}px — ${s}`);
}

/**
 * Scroll to the very bottom and confirm the last element on the page is not hidden
 * behind the fixed tab bar — the classic bug with a fixed mobile nav.
 */
async function checkBottomContentClearsTabBar(page: Page, where: string) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(150);

  const result = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Sections"]');
    const last = document.querySelector('[data-disclaimer]');
    if (!nav || !last) return null;
    if (getComputedStyle(nav).display === 'none') return null;
    const n = nav.getBoundingClientRect();
    const l = last.getBoundingClientRect();
    return { navTop: n.top, lastBottom: l.bottom };
  });

  if (result && result.lastBottom > result.navTop) {
    fail(
      `${where}: bottom content sits behind the tab bar (content ends at ${Math.round(result.lastBottom)}, bar starts at ${Math.round(result.navTop)})`,
    );
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  // CHROMIUM_PATH lets a preinstalled browser be used when its build number does
  // not match the one this Playwright version would download.
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      // DPR 3 mirrors a modern phone; touch changes which controls render.
      deviceScaleFactor: vp.mobile ? 3 : 1,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      userAgent: vp.mobile ? devices['iPhone 13'].userAgent : undefined,
    });
    const page = await context.newPage();
    page.on('pageerror', (err) => fail(`${vp.name}: console error — ${err.message}`));

    for (const route of ROUTES) {
      const where = `${vp.name}/${route}`;
      console.log(`- ${where}`);
      await page.goto(`${BASE}#/${route}`, { waitUntil: 'networkidle' });

      if (route === 'generate') {
        await page.getByRole('button', { name: /draw numbers|draw again/i }).click();
        await page.waitForTimeout(1400);
      }

      await checkNoHorizontalScroll(page, where);
      await checkTapTargets(page, where);
      await checkBottomContentClearsTabBar(page, where);
      await page.screenshot({ path: resolve(SHOTS, `${where.replace('/', '-')}.png`), fullPage: true });
    }

    // The luck controls live in a bottom sheet on phones; make sure it opens.
    if (vp.width < 768) {
      await page.goto(`${BASE}#/generate`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /tune your luck/i }).click();
      await page.waitForTimeout(500);
      const sheet = page.getByRole('dialog', { name: /tune your luck/i });
      if (!(await sheet.isVisible())) fail(`${vp.name}: bottom sheet did not open`);
      await checkTapTargets(page, `${vp.name}/sheet`);
      await page.screenshot({ path: resolve(SHOTS, `${vp.name}-sheet.png`) });
    }

    await context.close();
  }

  // Reduced motion must still render a complete, usable page.
  const rm = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  const rmPage = await rm.newPage();
  await rmPage.goto(`${BASE}#/generate`, { waitUntil: 'networkidle' });
  await rmPage.getByRole('button', { name: /draw numbers/i }).click();
  await rmPage.waitForTimeout(800);
  const orbs = await rmPage.getByRole('img').count();
  if (orbs < 6) fail(`reduced-motion: expected 6 orbs, found ${orbs}`);
  await rmPage.screenshot({ path: resolve(SHOTS, 'reduced-motion.png'), fullPage: true });
  await rm.close();

  await browser.close();

  if (failures) {
    console.error(`\n${failures} problem(s) found.`);
    process.exit(1);
  }
  console.log(`\nAll checks passed. Screenshots in ${SHOTS}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
