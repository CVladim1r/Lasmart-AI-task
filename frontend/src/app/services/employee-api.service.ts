import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Employee, EmployeeDraft, EmployeeSession } from '../models/employee';

@Injectable({ providedIn: 'root' })
export class EmployeeApiService {
  private readonly http = inject(HttpClient);

  login(email: string, password: string): Observable<EmployeeSession> {
    return this.http.post<EmployeeSession>('/api/auth/login', { email, password }, this.mutationOptions());
  }

  session(): Observable<EmployeeSession> {
    return this.http.get<EmployeeSession>('/api/auth/session', { withCredentials: true });
  }

  logout(): Observable<void> {
    return this.http.post<void>('/api/auth/logout', {}, this.mutationOptions());
  }

  list(): Observable<Employee[]> {
    return this.http.get<Employee[]>('/api/employees', { withCredentials: true });
  }

  create(draft: EmployeeDraft): Observable<Employee> {
    return this.http.post<Employee>('/api/employees', draft, this.mutationOptions());
  }

  update(id: string, draft: EmployeeDraft): Observable<void> {
    return this.http.put<void>(`/api/employees/${id}`, draft, this.mutationOptions());
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`/api/employees/${id}`, this.mutationOptions());
  }

  private mutationOptions() {
    return { withCredentials: true, headers: { 'X-Requested-With': 'XMLHttpRequest' } };
  }
}
