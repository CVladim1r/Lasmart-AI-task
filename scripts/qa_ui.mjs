import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_CORE_PATH || '/tmp/vibetime-qa/node_modules/playwright-core';
const { chromium } = require(playwrightPath);
const baseUrl = (process.env.QA_UI_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
const email = process.env.QA_EMAIL;
const password = process.env.QA_PASSWORD;
const executablePath = process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser';
const accentRgb = 'rgb(169, 46, 40)';

if (!email || !password) {
  console.error('Set QA_EMAIL and QA_PASSWORD in the environment.');
  process.exit(2);
}

const browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const fixtureEmail = `qa-ui-${randomUUID()}@example.test`;
let fixtureCreated = false;
const paginationFixtureIds = [];
let overlongFixtureId = null;
const reviewDir = new URL('../.impeccable/review/', import.meta.url);
const check = (condition, name) => {
  assert.ok(condition, name);
  console.log(`PASS ${name}`);
};
const capture = async name => {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: new URL(name, reviewDir).pathname, fullPage: true, animations: 'disabled' });
};

try {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Вход в портал' }).waitFor();
  await capture('login.png');
  check(await page.getByLabel('Email').count() === 1, 'login form is visible');
  await page.mouse.move(5, 5);
  await page.waitForFunction(color => getComputedStyle(document.querySelector('#login-password')).borderColor === color, 'rgb(146, 146, 146)');
  check(await page.locator('#login-password').evaluate(el => getComputedStyle(el).borderColor) === 'rgb(146, 146, 146)', 'normal input border uses the neutral token');
  await page.locator('#login-password').hover();
  await page.waitForFunction(color => getComputedStyle(document.querySelector('#login-password')).borderColor === color, 'rgb(39, 39, 39)');
  check(await page.locator('#login-password').evaluate(el => getComputedStyle(el).borderColor) === 'rgb(39, 39, 39)', 'hover input border uses the dark hover token');
  await page.locator('#login-password').focus();
  await page.waitForFunction(color => getComputedStyle(document.querySelector('#login-password')).borderColor === color, accentRgb);
  check(await page.locator('#login-password').evaluate(el => getComputedStyle(el).borderColor) === accentRgb, 'focused input border uses the design accent');

  await page.getByLabel('Email').fill('missing-qa-ui@example.test');
  await page.locator('#login-password').fill('wrong-password');
  await page.getByRole('button', { name: 'Войти' }).click();
  await page.getByText(/не найден/i).waitFor();
  check(await page.getByText(/не найден/i).count() === 1, 'unknown email shows an error');
  check(await page.locator('#login-email').evaluate(el => el.classList.contains('invalid-field')), 'unknown email is highlighted');
  await page.waitForFunction(color => getComputedStyle(document.querySelector('#login-email')).borderColor === color, accentRgb);
  check(await page.locator('#login-email').evaluate(el => getComputedStyle(el).borderColor) === accentRgb, 'unknown-email border uses the design accent');
  await capture('error.png');

  await page.getByLabel('Email').fill(email);
  await page.locator('#login-password').fill('wrong-password');
  await page.getByRole('button', { name: 'Войти' }).click();
  await page.getByText(/неверный пароль/i).waitFor();
  check(await page.getByText(/неверный пароль/i).count() === 1, 'wrong password shows an error');
  check(await page.locator('#login-password').evaluate(el => el.classList.contains('invalid-field')), 'wrong password is highlighted');
  await page.waitForFunction(color => getComputedStyle(document.querySelector('#login-password')).borderColor === color, accentRgb);
  check(await page.locator('#login-password').evaluate(el => getComputedStyle(el).borderColor) === accentRgb, 'wrong-password border uses the design accent');

  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await page.getByRole('heading', { name: 'Сотрудники' }).waitFor();
  check(true, 'seed employee can sign in');
  await page.waitForFunction(() => document.querySelector('section[aria-label="Список сотрудников"]')?.getAttribute('aria-busy') === 'false');
  const baselineCount = Number((await page.locator('.record-count').innerText()).match(/\d+/)[0]);
  await page.getByLabel('Фильтр по ФИО').fill('UIПроверка');

  await page.getByRole('button', { name: 'Создать сотрудника' }).first().click();
  await page.getByText('Новый сотрудник', { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement), null, { timeout: 2000 });
  await page.waitForFunction(color => getComputedStyle(document.querySelector('#employee-last-name')).borderColor === color, accentRgb);
  check(await page.locator('#employee-last-name').evaluate(el => getComputedStyle(el).borderColor) === accentRgb, 'focused form border uses the design accent');
  let focusStayedInDialog = true;
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    focusStayedInDialog = focusStayedInDialog && await page.evaluate(() => !!document.querySelector('[role="dialog"]')?.contains(document.activeElement));
  }
  await page.keyboard.press('Shift+Tab');
  focusStayedInDialog = focusStayedInDialog && await page.evaluate(() => !!document.querySelector('[role="dialog"]')?.contains(document.activeElement));
  check(focusStayedInDialog, 'Tab and Shift+Tab keep focus inside the dialog');
  await page.getByRole('button', { name: 'Создать сотрудника' }).last().click();
  await page.locator('.p-toast-message').filter({ hasText: 'Укажите фамилию' }).waitFor();
  check(await page.locator('input[name="lastName"]').evaluate(el => el.classList.contains('invalid-field')), 'required form fields are highlighted');
  await page.waitForFunction(color => getComputedStyle(document.querySelector('#employee-last-name')).borderColor === color, accentRgb);
  check(await page.locator('#employee-last-name').evaluate(el => getComputedStyle(el).borderColor) === accentRgb, 'invalid form border uses the design accent');
  await page.keyboard.press('Escape');
  await page.getByText('Новый сотрудник', { exact: true }).waitFor({ state: 'detached' });
  check(await page.evaluate(() => document.activeElement?.textContent?.includes('Создать сотрудника')), 'Escape closes the dialog and restores focus to the opener');

  await page.getByRole('button', { name: 'Создать сотрудника' }).first().click();
  await page.getByText('Новый сотрудник', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Отмена' }).click();
  await page.getByText('Новый сотрудник', { exact: true }).waitFor({ state: 'detached' });
  check(true, 'Cancel closes the employee dialog');

  await page.getByRole('button', { name: 'Создать сотрудника' }).first().click();
  await page.getByText('Новый сотрудник', { exact: true }).waitFor();
  await page.locator('input[name="lastName"]').fill('UIПроверка');
  await page.locator('input[name="firstName"]').fill('Тест');
  await page.locator('input[name="employeeEmail"]').fill(fixtureEmail);
  await page.locator('input[name="employeePassword"]').fill('ui-test-password-12');
  await page.locator('input[name="confirmPassword"]').fill('mismatched-password');
  await page.getByRole('button', { name: 'Создать сотрудника' }).last().click();
  await page.getByText('Пароли не совпадают').waitFor();
  check(true, 'password confirmation mismatch is shown');
  await page.keyboard.press('Escape');
  await page.getByText('Новый сотрудник', { exact: true }).waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Создать сотрудника' }).first().click();
  await page.getByText('Новый сотрудник', { exact: true }).waitFor();
  check(true, 'valid-create dialog starts without stale validation errors');
  await page.locator('input[name="lastName"]').fill('UIПроверка');
  await page.locator('input[name="firstName"]').fill('Тест');
  await page.locator('input[name="employeeEmail"]').fill(fixtureEmail);
  await page.locator('input[name="employeePassword"]').fill('ui-test-password-12');
  await page.locator('input[name="confirmPassword"]').fill('ui-test-password-12');
  await page.locator('.p-toast-message').waitFor({ state: 'detached' });
  check(await page.getByRole('alert').count() === 0, 'valid form clears validation errors');
  check(!await page.locator('input[name="confirmPassword"]').evaluate(el => el.classList.contains('invalid-field')), 'matching password confirmation clears its field error');
  await capture('form.png');
  await page.getByRole('button', { name: 'Создать сотрудника' }).last().click();
  await page.locator('tbody tr').filter({ hasText: fixtureEmail }).waitFor();
  await page.getByText('Новый сотрудник', { exact: true }).waitFor({ state: 'detached' });
  fixtureCreated = true;
  await capture('desktop.png');
  check(true, 'employee created through the UI');

  await page.getByRole('button', { name: 'Создать сотрудника' }).first().click();
  await page.getByText('Новый сотрудник', { exact: true }).waitFor();
  await page.locator('input[name="lastName"]').fill('Дубликат');
  await page.locator('input[name="firstName"]').fill('Проверка');
  await page.locator('input[name="employeeEmail"]').fill(fixtureEmail);
  await page.locator('input[name="employeePassword"]').fill('ui-test-password-12');
  await page.locator('input[name="confirmPassword"]').fill('ui-test-password-12');
  await page.getByRole('button', { name: 'Создать сотрудника' }).last().click();
  await page.getByText(/Этот email уже используется/).waitFor();
  check(await page.locator('input[name="employeeEmail"]').evaluate(el => el.classList.contains('invalid-field')), 'duplicate email is highlighted');
  await page.keyboard.press('Escape');
  await page.getByText('Новый сотрудник', { exact: true }).waitFor({ state: 'detached' });

  await page.getByLabel('Фильтр по ФИО').fill('uiпров');
  check(await page.getByText('UIПроверка Тест').count() === 1, 'name filter finds a mixed-case substring');
  await page.getByLabel('Фильтр по ФИО').fill('no-matching-employee');
  check(await page.getByText('Сотрудники не найдены').count() === 1, 'empty filter has an empty state');
  await page.getByLabel('Фильтр по ФИО').fill('');

  await page.getByLabel('Фильтр по ФИО').fill('UIПроверка');
  const fixtureRow = page.locator('tr').filter({ hasText: fixtureEmail });
  await fixtureRow.getByRole('button', { name: 'Редактировать' }).click();
  await page.locator('input[name="firstName"]').fill('Изменено');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await page.getByText('Редактировать сотрудника', { exact: true }).waitFor({ state: 'detached' });
  await page.getByText('Изменено').waitFor();
  check(await page.getByText('UIПроверка Изменено').count() === 1, 'profile edit is reflected in the table');

  await page.getByLabel('Фильтр по ФИО').fill('');
  const totalRows = baselineCount + 27;
  const pageFixtureIds = await page.evaluate(async () => {
    const created = [];
    for (let i = 0; i < 26; i++) {
      const password = 'pagination-test-12';
      const response = await fetch('/api/employees', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ lastName: `Страница${String(i).padStart(2, '0')}`, firstName: 'Тест', middleName: null, email: `qa-ui-page-${crypto.randomUUID()}@example.test`, password, confirmPassword: password }),
      });
      if (!response.ok) throw new Error(`pagination fixture create failed: ${response.status}`);
      created.push((await response.json()).id);
    }
    return created;
  });
  paginationFixtureIds.push(...pageFixtureIds);
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Сотрудники' }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 25);
  check(await page.locator('tbody tr').count() === 25, 'first page shows 25 rows');
  await page.getByRole('button', { name: 'Следующая страница' }).click();
  await page.getByText(`26–${Math.min(50, totalRows)} из ${totalRows}`, { exact: true }).waitFor();
  check(await page.locator('tbody tr').count() === Math.min(25, totalRows - 25), 'second page shows the expected rows');

  await page.getByRole('group', { name: 'Строк на странице' }).getByRole('button', { name: '50', exact: true }).click();
  await page.getByText(`1–${Math.min(50, totalRows)} из ${totalRows}`, { exact: true }).waitFor();
  check(await page.getByRole('button', { name: '50', exact: true }).evaluate(el => el.classList.contains('active')), 'page size can be changed to 50');
  check(await page.locator('tbody tr').count() === Math.min(50, totalRows), 'page size 50 shows the expected number of rows');
  await page.getByRole('group', { name: 'Строк на странице' }).getByRole('button', { name: '100', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.page-size button')].some(el => el.textContent?.trim() === '100' && el.classList.contains('active')));
  check(await page.getByRole('button', { name: '100', exact: true }).evaluate(el => el.classList.contains('active')), 'page size can be changed to 100');
  await page.getByRole('button', { name: 'ФИО' }).click();
  await page.locator('th[aria-sort="descending"] button').waitFor();
  check(await page.getByRole('columnheader', { name: /ФИО/ }).getAttribute('aria-sort') === 'descending', 'name sort toggles');
  await page.getByRole('button', { name: 'Email' }).click();
  await page.locator('th[aria-sort="ascending"] button').waitFor();
  check(await page.getByRole('columnheader', { name: /Email/ }).getAttribute('aria-sort') === 'ascending', 'email sort uses one active column');

  const batchDelete = await page.evaluate(async ids => {
    const statuses = [];
    for (const id of ids) statuses.push((await fetch(`/api/employees/${id}`, {
      method: 'DELETE', credentials: 'include', headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })).status);
    return statuses;
  }, paginationFixtureIds);
  check(batchDelete.every(status => status === 204), 'pagination fixtures cleaned up through the API');
  paginationFixtureIds.length = 0;
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Сотрудники' }).waitFor();
  await page.getByLabel('Фильтр по ФИО').fill('UIПроверка');
  await page.locator('tr').filter({ hasText: fixtureEmail }).waitFor();

  page.once('dialog', dialog => dialog.accept());
  await page.locator('tr').filter({ hasText: fixtureEmail }).getByRole('button', { name: 'Удалить' }).click();
  await page.getByText(fixtureEmail).waitFor({ state: 'detached' });
  fixtureCreated = false;
  check(true, 'employee delete action removes the row');
  await page.getByLabel('Фильтр по ФИО').fill('');

  await page.setViewportSize({ width: 390, height: 844 });
  check(await page.locator('body').evaluate(el => el.scrollWidth <= window.innerWidth), 'mobile workspace has no horizontal overflow');
  await capture('mobile.png');

  const longEmail = `qa-ui-long-${'x'.repeat(130)}-${randomUUID()}@example.test`;
  const longEmployee = await page.evaluate(async ({ email }) => {
    const password = 'overlong-test-password-12';
    const response = await fetch('/api/employees', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ lastName: 'Длинная'.repeat(14) + 'ХХ', firstName: 'Проверка', middleName: null, email, password, confirmPassword: password }),
    });
    return { status: response.status, employee: response.ok ? await response.json() : null };
  }, { email: longEmail });
  check(longEmployee.status === 201 && longEmail.length > 100 && ('Длинная'.repeat(14) + 'ХХ').length === 100, 'employee with a 100-character name and over-100 email is accepted');
  overlongFixtureId = longEmployee.employee.id;
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Сотрудники' }).waitFor();
  await page.getByLabel('Фильтр по ФИО').fill('Длинная');
  const longRow = page.locator('tbody tr').filter({ hasText: longEmail });
  await longRow.waitFor();
  check(await page.locator('body').evaluate(el => el.scrollWidth <= window.innerWidth), 'mobile workspace has no horizontal overflow');
  const longRowBounds = await longRow.boundingBox();
  const longEmailBounds = await longRow.locator('.email-cell').boundingBox();
  const longActionsBounds = await longRow.locator('.actions-cell').boundingBox();
  check(!!longRowBounds && !!longEmailBounds && !!longActionsBounds && longActionsBounds.x >= longEmailBounds.x + longEmailBounds.width - 1 && longActionsBounds.x + longActionsBounds.width <= 390, 'long name/email do not overlap visible row actions on mobile');
  await capture('overlong-mobile.png');
  page.once('dialog', dialog => dialog.accept());
  await longRow.getByRole('button', { name: 'Удалить' }).click();
  await longRow.waitFor({ state: 'detached' });
  overlongFixtureId = null;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByLabel('Фильтр по ФИО').fill('');
  await page.waitForFunction(count => document.querySelectorAll('tbody tr').length === count, Math.min(25, baselineCount));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Создать сотрудника' }).first().click();
  await page.getByText('Новый сотрудник', { exact: true }).waitFor();
  const mobileDialog = await page.locator('[role="dialog"]').boundingBox();
  check(!!mobileDialog && mobileDialog.x >= 0 && mobileDialog.x + mobileDialog.width <= 390, 'mobile form fits viewport width');
  await capture('mobile-form.png');
  await page.getByRole('button', { name: 'Отмена' }).click();
  await page.getByText('Новый сотрудник', { exact: true }).waitFor({ state: 'detached' });

  await page.setViewportSize({ width: 831, height: 911 });
  check(await page.locator('body').evaluate(el => el.scrollWidth <= window.innerWidth), '831px viewport has no horizontal overflow');
  await capture('user-831.png');

  await page.getByRole('button', { name: 'Выйти' }).click();
  await page.getByRole('heading', { name: 'Вход в портал' }).waitFor();
  await page.getByLabel('Email').fill('');
  check(pageErrors.length === 0, 'no uncaught browser errors');

  await page.setViewportSize({ width: 390, height: 844 });
  check(await page.locator('body').evaluate(el => el.scrollWidth <= window.innerWidth), 'mobile login has no horizontal overflow');
  await capture('mobile-login.png');
} finally {
  if (fixtureCreated) {
    try {
      const status = await page.evaluate(async fixtureEmail => {
        const response = await fetch('/api/employees', { credentials: 'include' });
        if (!response.ok) return response.status;
        const employees = await response.json();
        const fixture = employees.find(item => item.email === fixtureEmail);
        if (!fixture) return 404;
        return (await fetch(`/api/employees/${fixture.id}`, {
          method: 'DELETE', credentials: 'include', headers: { 'X-Requested-With': 'XMLHttpRequest' },
        })).status;
      }, fixtureEmail);
      if (![204, 404].includes(status)) throw new Error(`HTTP ${status}`);
    } catch {
      console.error('FAIL cleanup of UI fixture');
      process.exitCode = 1;
    }
  }
  if (paginationFixtureIds.length) {
    try {
      const statuses = await page.evaluate(async ids => {
        const result = [];
        for (const id of ids) result.push((await fetch(`/api/employees/${id}`, {
          method: 'DELETE', credentials: 'include', headers: { 'X-Requested-With': 'XMLHttpRequest' },
        })).status);
        return result;
      }, paginationFixtureIds);
      if (statuses.some(status => status !== 204 && status !== 404)) throw new Error('Unexpected cleanup status');
    } catch {
      console.error('FAIL cleanup of pagination fixtures');
      process.exitCode = 1;
    }
  }
  if (overlongFixtureId) {
    try {
      const status = await page.evaluate(async id => (await fetch(`/api/employees/${id}`, {
        method: 'DELETE', credentials: 'include', headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })).status, overlongFixtureId);
      if (status !== 204 && status !== 404) throw new Error(`HTTP ${status}`);
    } catch {
      console.error('FAIL cleanup of overlong UI fixture');
      process.exitCode = 1;
    }
  }
  await context.close();
  await browser.close();
}
