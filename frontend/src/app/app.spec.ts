import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { MessageService } from 'primeng/api';
import { vi } from 'vitest';
import { EmployeeApiService } from './services/employee-api.service';


describe('employee portal sign-in', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function renderLogin() {
    const fixture = TestBed.createComponent(App);
    http.expectOne('/api/auth/session').flush({ message: 'No session' }, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();
    return fixture;
  }

  it('renders the email and password sign-in form', () => {
    const fixture = renderLogin();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('h1')?.textContent).toContain('Вход в портал');
    expect(root.querySelector('#login-email')).not.toBeNull();
    expect(root.querySelector('#login-password')).not.toBeNull();
  });

  it('toggles password visibility without changing the value or submitting', async () => {
    const fixture = renderLogin();
    const app = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    const input = root.querySelector<HTMLInputElement>('#login-password')!;
    const toggle = root.querySelector<HTMLButtonElement>('.password-toggle')!;
    input.value = 'visibility-test-password';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(input.type).toBe('password');
    expect(app.loginPassword()).toBe('visibility-test-password');
    toggle.click();
    fixture.detectChanges();
    expect(input.type).toBe('text');
    expect(input.value).toBe('visibility-test-password');
    expect(toggle.getAttribute('aria-label')).toBe('Скрыть пароль');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    toggle.click();
    fixture.detectChanges();
    expect(input.type).toBe('password');
    expect(input.value).toBe('visibility-test-password');
    expect(toggle.getAttribute('aria-label')).toBe('Показать пароль');
    http.expectNone('/api/auth/login');
  });

  it('marks the email field when the account is not found', () => {
    const fixture = renderLogin();
    const app = fixture.componentInstance;
    app.loginEmail.set('missing@example.test');
    app.loginPassword.set('correct horse battery staple');
    app.login();
    const loginRequest = http.expectOne('/api/auth/login');
    expect(loginRequest.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    expect(loginRequest.request.withCredentials).toBe(true);
    loginRequest.flush(
      { code: 'email_not_found' },
      { status: 404, statusText: 'Not Found' },
    );
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('#login-email')?.classList.contains('invalid-field')).toBe(true);
    expect(app.loginError()).toContain('не найден');
    expect(root.querySelector('.error-banner')).toBeNull();
  });

  it('marks the password field when the password is wrong', () => {
    const fixture = renderLogin();
    const app = fixture.componentInstance;
    app.loginEmail.set('employee@example.test');
    app.loginPassword.set('wrong password');
    app.login();
    http.expectOne('/api/auth/login').flush(
      { code: 'invalid_password' },
      { status: 401, statusText: 'Unauthorized' },
    );
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(app.loginPasswordInvalid()).toBe(true);
    expect(app.loginError()).toContain('Неверный пароль');
    expect(root.querySelector('.error-banner')).toBeNull();
  });

  it('keeps retry feedback in toasts without inserting inline banners', () => {
    const fixture = renderLogin();
    const app = fixture.componentInstance;
    const root = fixture.nativeElement as HTMLElement;
    app.loginEmail.set('missing@example.test');
    app.loginPassword.set('wrong-password');
    app.login();
    http.expectOne('/api/auth/login').flush(
      { code: 'email_not_found' },
      { status: 404, statusText: 'Not Found' },
    );
    fixture.detectChanges();
    const notifications = fixture.debugElement.injector.get(MessageService);
    const add = vi.spyOn(notifications, 'add');

    app.login();
    const retry = http.expectOne('/api/auth/login');
    fixture.detectChanges();
    const pendingBanner = root.querySelector('.error-banner');
    const pendingEmailInvalid = app.loginEmailInvalid();
    const pending = app.loggingIn();
    retry.flush(
      { code: 'invalid_password' },
      { status: 401, statusText: 'Unauthorized' },
    );
    fixture.detectChanges();

    expect(pendingBanner).toBeNull();
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ key: 'errors', severity: 'error', detail: 'Неверный пароль', life: 5000 }));
    expect(pendingEmailInvalid).toBe(true);
    expect(pending).toBe(true);
    expect(app.loginError()).toContain('Неверный пароль');
    expect(root.querySelector('.error-banner')).toBeNull();
    expect(app.loginEmailInvalid()).toBe(false);
    expect(app.loginPasswordInvalid()).toBe(true);
    expect(app.loggingIn()).toBe(false);
  });

  it('sends CSRF header and credentials on employee mutations', () => {
    const api = TestBed.inject(EmployeeApiService);
    api.create({
      lastName: 'Test', firstName: 'Employee', middleName: '', email: 'employee@example.test',
      password: 'valid-password-12', confirmPassword: 'valid-password-12',
    }).subscribe();
    const request = http.expectOne('/api/employees');

    expect(request.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ id: 'id', lastName: 'Test', firstName: 'Employee', email: 'employee@example.test', createdAt: '' });
  });

  it('prefills employee fields and preserves values when changing another field', async () => {
    const fixture = renderLogin();
    const app = fixture.componentInstance;
    const employee = { id: 'employee-id', lastName: 'Тестов', firstName: 'Иван', middleName: 'Иванович', email: 'employee@example.test', createdAt: '' };
    app.signedIn.set(true);
    app.openEdit(employee);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    for (const [id, placeholder, value] of [['employee-last-name', 'Иванов', employee.lastName], ['employee-first-name', 'Иван', employee.firstName], ['employee-email', 'ivan@example.com', employee.email]]) {
      const input = root.querySelector<HTMLInputElement>(`#${id}`)!;
      expect(input.value).toBe(value);
      expect(input.placeholder).toBe(placeholder);
      expect(input.required).toBe(true);
    }
    expect(root.querySelector<HTMLInputElement>('#employee-middle-name')!.placeholder).toBe('Иванович');
    expect(root.querySelector<HTMLInputElement>('#employee-password')!.placeholder).toBe('');
    expect(root.querySelector<HTMLInputElement>('#employee-confirm-password')!.placeholder).toBe('');

    app.draft.set({ ...app.draft(), firstName: 'Новое имя' });
    app.saveEmployee();
    const update = http.expectOne('/api/employees/employee-id');
    expect(update.request.body).toEqual({
      lastName: employee.lastName, firstName: 'Новое имя', middleName: employee.middleName,
      email: employee.email, password: '', confirmPassword: '',
    });
    update.flush(null);
    http.expectOne('/api/employees').flush([]);
    expect(app.fieldErrors()).toEqual({});
  });

  it('keeps required validation when creating an employee', () => {
    const fixture = renderLogin();
    const app = fixture.componentInstance;
    app.openCreate();
    app.saveEmployee();
    expect(app.fieldErrors()['lastName']).toBeTruthy();
    expect(app.fieldErrors()['firstName']).toBeTruthy();
    expect(app.fieldErrors()['email']).toBeTruthy();
    http.expectNone('/api/employees');
  });

  it('validates required fields cleared during editing', () => {
    const fixture = renderLogin();
    const app = fixture.componentInstance;
    app.openEdit({ id: 'employee-id', lastName: 'Тестов', firstName: 'Иван', email: 'employee@example.test', createdAt: '' });
    app.draft.set({ ...app.draft(), firstName: '' });
    app.saveEmployee();
    expect(app.fieldErrors()['firstName']).toBe('Укажите имя');
    expect(app.dialogOpen()).toBe(true);
    http.expectNone('/api/employees/employee-id');
  });

  it('toggles both employee password fields independently and hides them on reopening', async () => {
    const fixture = renderLogin();
    const app = fixture.componentInstance;
    app.signedIn.set(true);
    app.openCreate();
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const password = root.querySelector<HTMLInputElement>('#employee-password')!;
    const confirmation = root.querySelector<HTMLInputElement>('#employee-confirm-password')!;
    for (const input of [password, confirmation]) {
      input.value = 'dummy-employee-password';
      input.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('[aria-controls="employee-password"]')!.click();
    fixture.detectChanges();
    expect(password.type).toBe('text');
    expect(confirmation.type).toBe('password');
    root.querySelector<HTMLButtonElement>('[aria-controls="employee-confirm-password"]')!.click();
    fixture.detectChanges();
    expect(confirmation.type).toBe('text');
    expect(password.value).toBe('dummy-employee-password');
    expect(confirmation.value).toBe('dummy-employee-password');
    http.expectNone('/api/employees');
    app.openCreate();
    fixture.detectChanges();
    expect(password.type).toBe('password');
    expect(confirmation.type).toBe('password');
  });

  it('clears login and form errors when the session ends', () => {
    const fixture = renderLogin();
    const app = fixture.componentInstance;
    app.loginError.set('Неверный пароль');
    app.loginEmailInvalid.set(true);
    app.loginPasswordInvalid.set(true);
    app.formError.set('Ошибка сохранения');
    app.fieldErrors.set({ email: 'Email занят' });
    app.logout();
    const logoutRequest = http.expectOne('/api/auth/logout');
    expect(logoutRequest.request.headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    logoutRequest.flush(null);

    expect(app.loginError()).toBe('');
    expect(app.loginEmailInvalid()).toBe(false);
    expect(app.loginPasswordInvalid()).toBe(false);
    expect(app.formError()).toBe('');
    expect(app.fieldErrors()).toEqual({});
  });

  it('announces local validation errors in a toast', () => {
    const fixture = renderLogin();
    const app = fixture.componentInstance;
    const add = vi.spyOn(fixture.debugElement.injector.get(MessageService), 'add');
    app.openCreate();
    app.saveEmployee();
    expect(add).toHaveBeenCalledWith(expect.objectContaining({
      severity: 'error', life: 5000,
      detail: expect.stringContaining('Укажите фамилию\nУкажите имя\nУкажите email'),
    }));
    expect(app.fieldErrors()['firstName']).toBeTruthy();
    http.expectNone('/api/employees');
  });

  it('announces backend validation and preserves the form and highlighted fields', () => {
    const fixture = renderLogin();
    const app = fixture.componentInstance;
    const add = vi.spyOn(fixture.debugElement.injector.get(MessageService), 'add');
    app.openCreate();
    app.draft.set({ lastName: 'Тест', firstName: 'Иван', email: 'employee@example.test', password: 'test-password-123', confirmPassword: 'test-password-123' });
    app.saveEmployee();
    http.expectOne('/api/employees').flush(
      { errors: { email: ['Этот email уже используется.'] } },
      { status: 409, statusText: 'Conflict' },
    );
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Этот email уже используется.' }));
    expect(app.dialogOpen()).toBe(true);
    expect(app.fieldErrors()['email']).toBe('Этот email уже используется.');
    expect(app.saving()).toBe(false);
  });

  it('announces list, delete and logout failures', () => {
    const fixture = renderLogin();
    const app = fixture.componentInstance;
    const add = vi.spyOn(fixture.debugElement.injector.get(MessageService), 'add');
    app.loadEmployees();
    http.expectOne('/api/employees').flush({}, { status: 500, statusText: 'Server Error' });
    expect(add).toHaveBeenLastCalledWith(expect.objectContaining({ detail: 'Не удалось загрузить список сотрудников' }));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    app.deleteEmployee({ id: 'employee-id', lastName: 'Тест', firstName: 'Иван', email: 'employee@example.test', createdAt: '' });
    http.expectOne('/api/employees/employee-id').flush({}, { status: 500, statusText: 'Server Error' });
    expect(add).toHaveBeenLastCalledWith(expect.objectContaining({ detail: 'Не удалось удалить сотрудника. Повторите попытку.' }));
    confirm.mockRestore();
    app.logout();
    http.expectOne('/api/auth/logout').flush({}, { status: 500, statusText: 'Server Error' });
    expect(add).toHaveBeenLastCalledWith(expect.objectContaining({ detail: 'Не удалось завершить сеанс. Попробуйте ещё раз.' }));
  });
});
