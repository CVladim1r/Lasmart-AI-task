export interface Employee {
  id: string;
  lastName: string;
  firstName: string;
  middleName?: string | null;
  email: string;
  createdAt: string;
}

export interface EmployeeDraft {
  lastName: string;
  firstName: string;
  middleName?: string | null;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface EmployeeSession {
  id: string;
  email: string;
  fullName: string;
}
