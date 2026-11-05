import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || '/tmp/vibetime-qa/node_modules/playwright-core');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser', args: ['--no-sandbox'] });
const baseUrl = process.env.QA_UI_URL || 'http://localhost:8080';
const reviewDir = new URL('../.impeccable/review/', import.meta.url);
await mkdir(reviewDir, { recursive: true });
const rects = page => page.evaluate(() => Object.fromEntries(['#login-email', '#login-password', 'button.login-action'].map(selector => {
  const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
  return [selector, { x, y, width, height }];
})));
const unchanged = (before, after, state) => {
  for (const selector of Object.keys(before)) {
    for (const dimension of ['x', 'y', 'width', 'height']) {
      assert.ok(Math.abs(before[selector][dimension] - after[selector][dimension]) < 0.5, `${state}: ${selector} ${dimension} changed`);
    }
  }
};

try {
  for (const viewport of [{ width: 1223, height: 906 }, { width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      let posts = 0;
      await page.route('**/api/auth/login', async route => {
        posts++;
        await new Promise(resolve => setTimeout(resolve, 350));
        await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'email_not_found' }) });
      });
      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      for (const [id, hint] of [['login-email', 'ivan@example.com'], ['login-password', 'Введите пароль']]) {
        const field = page.locator(`#${id}`);
        assert.equal(await field.getAttribute('placeholder'), hint);
        assert.equal(await field.inputValue(), '');
        assert.equal(await field.evaluate(el => getComputedStyle(el, '::placeholder').color), 'rgb(101, 101, 101)');
      }
      await page.locator('#login-email').fill('missing-qa@example.test');
      const input = page.locator('#login-password');
      const dummy = 'visibility-test-password';
      await input.fill(dummy);
      const beforeToggle = await rects(page);
      const waitForType = type => page.waitForFunction(expected => document.querySelector('#login-password').type === expected, type);
      await page.getByRole('button', { name: 'Показать пароль', exact: true }).click();
      await waitForType('text');
      assert.equal(await input.getAttribute('type'), 'text');
      assert.equal(await input.inputValue(), dummy);
      assert.equal(await page.getByRole('button', { name: 'Скрыть пароль', exact: true }).getAttribute('aria-pressed'), 'true');
      await page.keyboard.press('Space');
      await waitForType('password');
      assert.equal(await input.getAttribute('type'), 'password');
      await page.keyboard.press('Enter');
      await waitForType('text');
      assert.equal(await input.getAttribute('type'), 'text');
      await page.getByRole('button', { name: 'Скрыть пароль', exact: true }).click();
      await waitForType('password');
      assert.equal(await input.getAttribute('type'), 'password');
      assert.equal(await input.inputValue(), dummy);
      assert.equal(posts, 0, 'eye button submitted the form');
      unchanged(beforeToggle, await rects(page), 'visibility toggle');

      const submit = page.locator('button.login-action');
      await submit.click();
      await page.getByRole('alert').waitFor();
      await page.waitForFunction(() => !document.querySelector('button.login-action').disabled);
      const beforeRetry = await rects(page);
      const request = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/api/auth/login'));
      await submit.click();
      await request;
      await page.waitForFunction(() => document.querySelector('button.login-action').disabled);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.getByRole('alert').count(), 1, 'error banner disappeared while pending');
      unchanged(beforeRetry, await rects(page), 'pending retry');
      await page.waitForFunction(() => !document.querySelector('button.login-action').disabled);
      unchanged(beforeRetry, await rects(page), 'retry response');
      assert.equal(posts, 2);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: new URL(`login-retry-${viewport.width}.png`, reviewDir).pathname, fullPage: true, animations: 'disabled' });
      console.log(`PASS ${viewport.width}x${viewport.height}: retry geometry stable; eye click/Space/Enter preserve value without submitting`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
