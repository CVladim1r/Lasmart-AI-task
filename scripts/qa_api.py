#!/usr/bin/env python3
"""API smoke/regression checks for a disposable local VibeTime QA instance.

Required environment: QA_BASE_URL (default http://127.0.0.1:8080),
SEED_EMAIL and SEED_PASSWORD. Test-created employees use unique emails and are
deleted in a finally block. No existing employee is modified or deleted.
"""

from __future__ import annotations

import http.cookiejar
import json
import os
import sys
import urllib.error
import urllib.request
import uuid


BASE_URL = os.environ.get("QA_BASE_URL", "http://127.0.0.1:8080").rstrip("/")
SEED_EMAIL = os.environ.get("QA_EMAIL") or os.environ.get("SEED_EMAIL")
SEED_PASSWORD = os.environ.get("QA_PASSWORD") or os.environ.get("SEED_PASSWORD")
ORIGIN = os.environ.get("QA_ORIGIN", "http://localhost:4200")


class Api:
    def __init__(self) -> None:
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))

    def request(self, method: str, path: str, body: dict | None = None, *, csrf: bool = True):
        data = None if body is None else json.dumps(body).encode()
        headers = {"Accept": "application/json"}
        if data is not None:
            headers["Content-Type"] = "application/json"
        if csrf and method in {"POST", "PUT", "PATCH", "DELETE"}:
            headers.update({"Origin": ORIGIN, "X-Requested-With": "XMLHttpRequest"})
        request = urllib.request.Request(f"{BASE_URL}{path}", data=data, headers=headers, method=method)
        try:
            response = self.opener.open(request, timeout=15)
            raw = response.read()
            return response.status, json.loads(raw) if raw else None
        except urllib.error.HTTPError as error:
            raw = error.read()
            try:
                payload = json.loads(raw) if raw else None
            except json.JSONDecodeError:
                payload = raw.decode(errors="replace")
            return error.code, payload


def check(condition: bool, description: str) -> None:
    if not condition:
        raise AssertionError(description)
    print(f"PASS {description}")


def main() -> int:
    if not SEED_EMAIL or not SEED_PASSWORD:
        print("Set QA_EMAIL/QA_PASSWORD (or SEED_EMAIL/SEED_PASSWORD) in the environment.", file=sys.stderr)
        return 2
    api = Api()
    created_ids: list[str] = []
    try:
        status, payload = api.request("GET", "/api/health")
        check(status == 200 and payload.get("status") == "ok", "health endpoint")

        # A fresh client must not access the protected employee list.
        anonymous = Api()
        status, _ = anonymous.request("GET", "/api/employees")
        check(status == 401, "employee list requires authentication")

        status, payload = anonymous.request("POST", "/api/auth/login", {"email": "missing-qa@example.test", "password": "wrong"})
        check(status == 404 and payload.get("code") == "email_not_found", "unknown login has distinct response")
        status, payload = anonymous.request("POST", "/api/auth/login", {"email": SEED_EMAIL, "password": "incorrect-password"})
        check(status == 401 and payload.get("code") == "invalid_password", "wrong password has distinct response")
        status, payload = api.request("POST", "/api/auth/login", {"email": SEED_EMAIL, "password": SEED_PASSWORD})
        check(status == 200, "configured seed account can log in")

        # A write without the expected origin headers must be rejected.
        status, _ = api.request("POST", "/api/employees", {}, csrf=False)
        check(status == 403, "write request without CSRF headers is rejected")

        status, rows = api.request("GET", "/api/employees")
        check(status == 200 and isinstance(rows, list), "authenticated employee list")
        check(all("password" not in row and "passwordHash" not in row for row in rows), "employee API never returns password data")

        suffix = uuid.uuid4().hex
        email = f"qa-{suffix}@example.test"
        base = {"lastName": "Тестов", "firstName": "Проверка", "middleName": "QA", "email": email}

        status, payload = api.request("POST", "/api/employees", {**base, "password": "short", "confirmPassword": "short"})
        check(status == 400, "password below 12 characters is rejected")
        status, payload = api.request("POST", "/api/employees", {**base, "password": "valid-password-12", "confirmPassword": "different-password"})
        check(status == 400, "password confirmation mismatch is rejected")
        status, payload = api.request("POST", "/api/employees", {"lastName": "", "firstName": "", "email": "", "password": "valid-password-12", "confirmPassword": "valid-password-12"})
        check(status == 400, "required fields are validated by API")

        status, employee = api.request("POST", "/api/employees", {**base, "password": "valid-password-12", "confirmPassword": "valid-password-12"})
        check(status == 201 and employee.get("email") == email, "create employee")
        employee_id = employee["id"]
        created_ids.append(employee_id)
        check("passwordHash" not in employee and "password" not in employee, "created employee response excludes password data")

        status, payload = api.request("POST", "/api/employees", {**base, "password": "valid-password-12", "confirmPassword": "valid-password-12"})
        check(status == 409 and payload.get("code") == "email_in_use", "duplicate email is rejected")
        status, payload = api.request("POST", "/api/employees", {**base, "email": email.upper(), "password": "valid-password-12", "confirmPassword": "valid-password-12"})
        check(status == 409 and payload.get("code") == "email_in_use", "duplicate email is rejected regardless of letter case")
        status, _ = api.request("POST", "/api/employees", {**base, "middleName": "x" * 101, "password": "valid-password-12", "confirmPassword": "valid-password-12"})
        check(status == 400, "middle name over 100 characters is rejected")

        # Exercise all 73 ASCII characters independently of the seed configuration.
        password73 = "a" * 72 + "B"
        email73 = f"qa-{suffix}-73@example.test"
        status, employee73 = api.request("POST", "/api/employees", {**base, "email": email73, "password": password73, "confirmPassword": password73})
        check(status == 201, "create employee with a 73-character password")
        employee73_id = employee73["id"]
        created_ids.append(employee73_id)
        status, _ = Api().request("POST", "/api/auth/login", {"email": email73, "password": password73})
        check(status == 200, "73-character password logs in")
        status, payload = Api().request("POST", "/api/auth/login", {"email": email73, "password": "a" * 72 + "C"})
        check(status == 401 and payload.get("code") == "invalid_password", "changing only the 73rd password character fails login")

        status, _ = api.request("PUT", f"/api/employees/{employee_id}", {**base, "email": f"qa-{suffix}-edited@example.test", "password": None, "confirmPassword": None})
        edited_email = f"qa-{suffix}-edited@example.test"
        check(status == 204, "update employee profile while preserving empty password")
        status, _ = Api().request("POST", "/api/auth/login", {"email": edited_email, "password": "valid-password-12"})
        check(status == 200, "profile update preserves the existing password")

        status, rows = api.request("GET", "/api/employees")
        check(status == 200 and any(row.get("id") == employee_id for row in rows), "created employee persists in list")

        status, _ = api.request("DELETE", f"/api/employees/{employee_id}")
        check(status == 204, "delete test-created employee")
        created_ids.remove(employee_id)
        status, rows = api.request("GET", "/api/employees")
        remaining = [row for row in rows if row.get("id") == employee_id]
        check(status == 200 and not remaining, f"deleted employee is absent from list (remaining={len(remaining)})")
        return 0
    except Exception as error:  # Keep cleanup and print only the failure message, never secrets.
        print(f"FAIL {type(error).__name__}: {error}", file=sys.stderr)
        return 1
    finally:
        for employee_id in created_ids:
            api.request("DELETE", f"/api/employees/{employee_id}")


if __name__ == "__main__":
    raise SystemExit(main())
