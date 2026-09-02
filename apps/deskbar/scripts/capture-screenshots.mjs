// Regenerates screenshots/*.png in mock mode so catalog screenshots don't go stale on UI changes.
//
// Each shot uses an isolated, mock-seeded context. Run bun run screenshots (needs Chromium).
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const screenshotsDir = path.join(root, 'screenshots');
const port = 5183;
const url = `http://localhost:${port}`;

// Car Thing's actual screen resolution — matches the existing PNGs.
const viewport = { width: 800, height: 480 };

const HISTORY_STORE_KEY = 'deskbar-mock-store:deskbar/history';
const SESSION_STORE_KEY = 'deskbar-mock-store:deskbar/session';

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`vite dev server never came up at ${url}`);
}

async function seedHistory(context) {
  const entries = [
    {
      id: 'screenshot-seed-1',
      issueKey: 'DESK-2',
      issueSummary: 'Test the focus timer end to end',
      seconds: 18 * 60,
      loggedAt: Date.now(),
    },
  ];
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [HISTORY_STORE_KEY, JSON.stringify(entries)],
  );
}

// Backdates startedAt to fake minutesElapsed passing, avoiding a real sleep, then reloads.
async function backdateFocusSession(page, minutesElapsed) {
  await page.evaluate(
    ({ key, ms }) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const state = JSON.parse(raw);
      if (state.focus) state.focus.startedAt -= ms;
      window.localStorage.setItem(key, JSON.stringify(state));
    },
    { key: SESSION_STORE_KEY, ms: minutesElapsed * 60_000 },
  );
  await page.reload();
}

// .screen fades/slides over 200ms (index.css); wait it out so shots avoid mid-transition.
const FADE_IN_MS = 250;

async function shoot(page, name) {
  await page.waitForTimeout(FADE_IN_MS);
  await page.screenshot({ path: path.join(screenshotsDir, name) });
  console.log(`  wrote ${name}`);
}

async function main() {
  await mkdir(screenshotsDir, { recursive: true });

  console.log('Starting vite dev server in mock mode...');
  const vite = spawn('bunx', ['vite', '--port', String(port), '--strictPort'], {
    cwd: root,
    env: { ...process.env, VITE_MOCK: '1' },
    stdio: 'pipe',
  });
  vite.on('error', err => {
    throw err;
  });

  try {
    await waitForServer();
    const browser = await chromium.launch();

    try {
      console.log('01-home.png');
      {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        await page.goto(url);
        await page.locator('.tile-focus').waitFor();
        await shoot(page, '01-home.png');
        await context.close();
      }

      console.log('02-focus-setup.png');
      {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        await page.goto(url);
        await page.locator('.tile-focus').click();
        await page.locator('.issue-row').first().waitFor();
        await shoot(page, '02-focus-setup.png');
        await context.close();
      }

      console.log('03-focus-running.png + 04-paused.png');
      {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        await page.goto(url);
        await page.locator('.tile-focus').click();
        await page.locator('.issue-row', { hasText: 'DESK-2' }).waitFor();
        await page.locator('.issue-row', { hasText: 'DESK-2' }).click();
        await page.locator('.btn-primary').click();
        await page.locator('.focus-running .clock').waitFor();
        await shoot(page, '03-focus-running.png');

        // Pause mid-session, not at the start, so the paused shot shows a mid-flight countdown.
        await backdateFocusSession(page, 6);
        await page.locator('.focus-running .clock').waitFor();
        await page.locator('.focus-running .btn-secondary').click();
        await page.locator('.clock-paused').waitFor();
        await shoot(page, '04-paused.png');
        await context.close();
      }

      console.log('05-today.png');
      {
        const context = await browser.newContext({ viewport });
        await seedHistory(context);
        const page = await context.newPage();
        await page.goto(url);
        await page.locator('.today-bar').click();
        await page.locator('.history-row').first().waitFor();
        await shoot(page, '05-today.png');
        await context.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    vite.kill();
  }

  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
