import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || '/tmp/vibetime-qa/node_modules/playwright-core');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser', args: ['--no-sandbox'] });
const reviewDir = new URL('../.impeccable/review/', import.meta.url);
await mkdir(reviewDir, { recursive: true });
try {
  for (const viewport of [{ width: 1223, height: 906 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    try {
      const page = await context.newPage();
      let employee = { id: '10000000-0000-0000-0000-000000000001', lastName: 'Петров', firstName: 'Иван', middleName: 'Сергеевич', email: 'employee@example.test', createdAt: '2026-11-06T00:00:00Z' };
      let posts = 0;
      const updates = [];
      await page.route('**/api/**', async route => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        if (path === '/api/auth/session') return route.fulfill({ json: { id: employee.id, fullName: 'Петров Иван', email: employee.email } });
        if (request.method() === 'PUT') {
          const body = request.postDataJSON();
          updates.push(body);
          employee = { ...employee, ...body };
          return route.fulfill({ status: 204 });
        }
        if (request.method() === 'POST') posts++;
        return route.fulfill({ json: path === '/api/employees' ? [employee] : {} });
      });
      await page.goto(process.env.QA_UI_URL || 'http://localhost:8080', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.getByRole('button', { name: 'Создать сотрудника' }).click();
      await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement));
      const cancel = page.getByRole('button', { name: 'Отмена', exact: true });
      await cancel.hover();
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.secondary-action .p-button-label')).color === 'rgb(101, 101, 101)');
      assert.equal(await cancel.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(241, 241, 241)');
      await page.screenshot({ path: `/tmp/vibetime-cancel-hover-${viewport.width}.png`, animations: 'disabled' });
      await page.mouse.move(0, 0);
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.secondary-action .p-button-label')).color === 'rgb(39, 39, 39)');
      for (const [id, hint] of [['employee-last-name', 'Иванов'], ['employee-first-name', 'Иван'], ['employee-middle-name', 'Иванович'], ['employee-email', 'ivan@example.com'], ['employee-password', ''], ['employee-confirm-password', '']]) {
        assert.equal(await page.locator(`#${id}`).evaluate(el => el.placeholder), hint);
        assert.equal(await page.locator(`#${id}`).inputValue(), '');
      }
      await page.screenshot({ path: new URL(`create-hints-${viewport.width}.png`, reviewDir).pathname, fullPage: true, animations: 'disabled' });
      await page.locator('#employee-last-name').fill('Новый');
      await page.locator('#employee-first-name').fill('Сотрудник');
      await page.locator('#employee-email').fill('new@example.test');
      for (const id of ['employee-password', 'employee-confirm-password']) {
        const input = page.locator(`#${id}`);
        await input.fill('dummy-employee-password');
        const toggle = page.locator(`button[aria-controls="${id}"]`);
        await toggle.click();
        await page.waitForFunction(id => document.getElementById(id).type === 'text', id);
        assert.equal(await input.inputValue(), 'dummy-employee-password');
        assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
        await page.keyboard.press('Space');
        await page.waitForFunction(id => document.getElementById(id).type === 'password', id);
        await page.keyboard.press('Enter');
        await page.waitForFunction(id => document.getElementById(id).type === 'text', id);
        assert.equal(await input.inputValue(), 'dummy-employee-password');
      }
      assert.equal(posts, 0, 'eye submitted the create form');
      await page.getByRole('button', { name: 'Отмена', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'detached' });
      await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement));
      for (const [id, hint, value] of [['employee-last-name', 'Иванов', employee.lastName], ['employee-first-name', 'Иван', employee.firstName], ['employee-email', 'ivan@example.com', employee.email]]) {
        const input = page.locator(`#${id}`);
        assert.equal(await input.inputValue(), value);
        assert.equal(await input.evaluate(el => el.placeholder), hint);
        assert.equal(await input.evaluate(el => getComputedStyle(el, '::placeholder').color), 'rgb(101, 101, 101)');
        assert.equal(await input.evaluate(el => getComputedStyle(el).color), 'rgb(39, 39, 39)');
        assert.equal(await input.evaluate(el => el.required), true);
      }
      for (const id of ['employee-password', 'employee-confirm-password']) {
        assert.equal(await page.locator(`#${id}`).getAttribute('type'), 'password');
        assert.equal(await page.locator(`#${id}`).inputValue(), '');
        await page.locator(`button[aria-controls="${id}"]`).click();
        await page.waitForFunction(id => document.getElementById(id).type === 'text', id);
        await page.locator(`button[aria-controls="${id}"]`).click();
        await page.waitForFunction(id => document.getElementById(id).type === 'password', id);
      }
      await page.locator('#employee-first-name').fill('Новое имя');
      await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'detached' });
      assert.equal(updates.length, 1);
      assert.equal(updates[0].lastName, 'Петров');
      assert.equal(updates[0].firstName, 'Новое имя');
      assert.equal(updates[0].email, 'employee@example.test');
      assert.equal(updates[0].password, '');
      assert.equal(updates[0].confirmPassword, '');
      await page.getByText('Петров Новое имя Сергеевич', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement));
      await page.locator('#employee-email').fill('changed@example.test');
      await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'detached' });
      assert.equal(updates[1].firstName, 'Новое имя');
      assert.equal(updates[1].lastName, 'Петров');
      assert.equal(updates[1].email, 'changed@example.test');
      await page.getByText('changed@example.test', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement));
      await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement));
      await page.screenshot({ path: new URL(`edit-placeholders-${viewport.width}.png`, reviewDir).pathname, fullPage: true, animations: 'disabled' });
      assert.equal(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth), true);
      console.log(`PASS ${viewport.width}x${viewport.height}: cancel hover colors, placeholders, partial name/email update, both password eyes, keyboard and reset`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
