CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    last_name VARCHAR(100) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    email VARCHAR(254) NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT employees_email_not_blank CHECK (length(trim(email)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS employees_email_lower_unique_idx ON employees (lower(email));

CREATE INDEX IF NOT EXISTS employees_name_sort_idx
    ON employees (last_name, first_name, middle_name, id);

CREATE TABLE IF NOT EXISTS application_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
