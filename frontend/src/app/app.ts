import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, map } from 'rxjs';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Toast } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { PrimeNG } from 'primeng/config';
import { Employee, EmployeeDraft, EmployeeSession } from './models/employee';
import { EmployeeApiService } from './services/employee-api.service';

@Component({
  imports: [FormsModule, Button, Dialog, InputText, Toast],
  providers: [MessageService],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly api = inject(EmployeeApiService);
  private readonly messages = inject(MessageService);
  private readonly primeConfig = inject(PrimeNG);
  readonly signedIn = signal(false);
  readonly restoringSession = signal(true);
  readonly currentUser = signal<EmployeeSession | null>(null);
  readonly employees = signal<Employee[]>([]);
  readonly loading = signal(false);
  readonly loggingIn = signal(false);
  readonly saving = signal(false);
  readonly loginError = signal('');
  readonly loginEmailInvalid = signal(false);
  readonly loginPasswordInvalid = signal(false);
  readonly formError = signal('');
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly deleteError = signal('');
  readonly loginEmail = signal('');
  readonly loginPassword = signal('');
  readonly loginPasswordVisible = signal(false);
  readonly employeePasswordVisible = signal(false);
  readonly confirmPasswordVisible = signal(false);
  readonly dialogOpen = signal(false);
  readonly editing = signal<Employee | null>(null);
  readonly draft = signal<EmployeeDraft>(this.emptyDraft());
  readonly pageSize = signal(25);
  readonly page = signal(0);
  readonly filter = signal('');
  readonly sortDirection = signal<'asc' | 'desc'>('asc');
  readonly sortField = signal<'name' | 'email'>('name');

  constructor() {
    this.primeConfig.setTranslation({ aria: { ...this.primeConfig.translation.aria, close: 'Закрыть уведомление' } });
    this.api.session().subscribe({
      next: (session) => { this.currentUser.set(session); this.signedIn.set(true); this.restoringSession.set(false); this.loadEmployees(); },
      error: (error) => {
        this.signedIn.set(false);
        this.restoringSession.set(false);
        if (error.status !== 401) this.showError('Не удалось проверить сеанс. Попробуйте войти.');
      },
    });
  }

  get filteredEmployees(): Employee[] {
    const needle = this.filter().trim().toLocaleLowerCase('ru');
    return [...this.employees()]
      .filter((employee) => !needle || this.fullName(employee).toLocaleLowerCase('ru').includes(needle))
      .sort((a, b) => {
        const left = this.sortField() === 'name' ? this.fullName(a) : a.email;
        const right = this.sortField() === 'name' ? this.fullName(b) : b.email;
        return left.localeCompare(right, 'ru', { sensitivity: 'base' }) * (this.sortDirection() === 'asc' ? 1 : -1);
      });
  }

  get visibleEmployees(): Employee[] {
    const start = this.page() * this.pageSize();
    return this.filteredEmployees.slice(start, start + this.pageSize());
  }

  fullName(employee: Employee): string {
    return [employee.lastName, employee.firstName, employee.middleName].filter(Boolean).join(' ');
  }

  sortBy(field: 'name' | 'email'): void {
    if (this.sortField() === field) this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    else { this.sortField.set(field); this.sortDirection.set('asc'); }
  }

  login(): void {
    if (this.loggingIn()) return;
    this.loggingIn.set(true);
    this.api.login(this.loginEmail(), this.loginPassword()).pipe(finalize(() => this.loggingIn.set(false))).subscribe({
      next: (session) => {
        this.messages.clear('errors');
        this.loginError.set('');
        this.loginPasswordVisible.set(false);
        this.loginEmailInvalid.set(false);
        this.loginPasswordInvalid.set(false);
        this.currentUser.set(session);
        this.signedIn.set(true);
        this.loadEmployees();
      },
      error: (error) => {
        this.loginEmailInvalid.set(false);
        this.loginPasswordInvalid.set(false);
        if (error.status === 404) {
          this.loginEmailInvalid.set(true);
          this.loginError.set('Сотрудник с таким email не найден');
        } else if (error.status === 401) {
          this.loginPasswordInvalid.set(true);
          this.loginError.set('Неверный пароль');
        } else if (error.status === 400) {
          const errors = error.error?.errors as Record<string, string[]> | undefined;
          if (errors?.['email']) this.loginEmailInvalid.set(true);
          if (errors?.['password']) this.loginPasswordInvalid.set(true);
          this.loginError.set(errors?.['email']?.[0] ?? errors?.['password']?.[0] ?? 'Введите email и пароль.');
        } else this.loginError.set('Не удалось выполнить вход. Попробуйте ещё раз.');
        this.showError(this.loginError());
      },
    });
  }

  loadEmployees(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (rows) => {
        this.employees.set(rows);
        const lastPage = Math.max(0, Math.ceil(this.filteredEmployees.length / this.pageSize()) - 1);
        if (this.page() > lastPage) this.page.set(lastPage);
        this.formError.set('');
        this.deleteError.set('');
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        if (error.status === 401) { this.resetSession(); this.showError('Сеанс завершён. Войдите снова.'); }
        else { this.formError.set('Не удалось загрузить список сотрудников'); this.showError(this.formError()); }
      },
    });
  }

  logout(): void {
    this.api.logout().subscribe({
      next: () => this.resetSession(),
      error: (error) => {
        if (error.status === 401) { this.resetSession(); this.showError('Сеанс уже завершён.'); }
        else { this.deleteError.set('Не удалось завершить сеанс. Попробуйте ещё раз.'); this.showError(this.deleteError()); }
      },
    });
  }

  openCreate(): void {
    this.messages.clear('errors');
    this.employeePasswordVisible.set(false);
    this.confirmPasswordVisible.set(false);
    this.editing.set(null);
    this.draft.set(this.emptyDraft());
    this.formError.set('');
    this.fieldErrors.set({});
    this.dialogOpen.set(true);
  }

  openEdit(employee: Employee): void {
    this.messages.clear('errors');
    this.employeePasswordVisible.set(false);
    this.confirmPasswordVisible.set(false);
    this.editing.set(employee);
    this.draft.set({ lastName: employee.lastName, firstName: employee.firstName, email: employee.email, middleName: employee.middleName ?? '', password: '', confirmPassword: '' });
    this.formError.set('');
    this.fieldErrors.set({});
    this.dialogOpen.set(true);
  }

  saveEmployee(): void {
    if (this.saving()) return;
    const draft = this.draft();
    const errors: Record<string, string> = {};
    if (!draft.lastName.trim()) errors['lastName'] = 'Укажите фамилию';
    if (!draft.firstName.trim()) errors['firstName'] = 'Укажите имя';
    if (!draft.email.trim()) errors['email'] = 'Укажите email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) errors['email'] = 'Введите корректный email';
    if (!this.editing() || draft.password) {
      if (draft.password.length < 12) errors['password'] = 'Не менее 12 символов';
      if (draft.password !== draft.confirmPassword) errors['confirmPassword'] = 'Пароли не совпадают';
    }
    if (Object.keys(errors).length) {
      this.fieldErrors.set(errors);
      this.formError.set('Проверьте поля, отмеченные красным');
      this.showError(Object.values(errors).join('\n'));
      return;
    }
    this.fieldErrors.set({});
    const request = this.editing()
      ? this.api.update(this.editing()!.id, draft).pipe(map(() => null))
      : this.api.create(draft).pipe(map(() => null));
    this.saving.set(true);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => { this.messages.clear('errors'); this.dialogOpen.set(false); this.loadEmployees(); },
      error: (error) => {
        if (error.status === 401) { this.resetSession(); this.showError('Сеанс завершён. Войдите снова.'); return; }
        const serverErrors = error.error?.errors as Record<string, string[]> | undefined;
        if (serverErrors) this.fieldErrors.set(Object.fromEntries(Object.entries(serverErrors).map(([key, messages]) => [key, messages[0]])));
        this.formError.set(error.status === 409 ? 'Этот email уже используется' : 'Не удалось сохранить данные. Проверьте поля и попробуйте ещё раз.');
        this.showError(serverErrors ? Object.values(this.fieldErrors()).join('\n') || this.formError() : this.formError());
      },
    });
  }

  deleteEmployee(employee: Employee): void {
    if (!window.confirm(`Удалить сотрудника «${this.fullName(employee)}»?`)) return;
    this.deleteError.set('');
    this.api.delete(employee.id).subscribe({
      next: () => { this.messages.clear('errors'); this.loadEmployees(); },
      error: (error) => {
        if (error.status === 401) { this.resetSession(); this.showError('Сеанс завершён. Войдите снова.'); }
        else { this.deleteError.set(error.status === 404 ? 'Сотрудник уже удалён или не найден' : 'Не удалось удалить сотрудника. Повторите попытку.'); this.showError(this.deleteError()); }
      },
    });
  }

  private showError(detail: string): void {
    this.messages.clear('errors');
    this.messages.add({ key: 'errors', severity: 'error', summary: 'Ошибка', detail, life: 5000 });
  }

  private resetSession(): void {
    this.messages.clear('errors');
    this.currentUser.set(null);
    this.signedIn.set(false);
    this.employees.set([]);
    this.loginPassword.set('');
    this.loginPasswordVisible.set(false);
    this.employeePasswordVisible.set(false);
    this.confirmPasswordVisible.set(false);
    this.loginError.set('');
    this.loginEmailInvalid.set(false);
    this.loginPasswordInvalid.set(false);
    this.formError.set('');
    this.fieldErrors.set({});
    this.deleteError.set('');
    this.dialogOpen.set(false);
    this.editing.set(null);
  }

  private emptyDraft(): EmployeeDraft {
    return { lastName: '', firstName: '', middleName: '', email: '', password: '', confirmPassword: '' };
  }
}
