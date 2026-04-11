-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → your project → SQL Editor)

CREATE TABLE submissions (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  phone       TEXT NOT NULL,
  email       TEXT,
  service     TEXT,
  message     TEXT,
  status      TEXT NOT NULL DEFAULT 'new',
  notes       TEXT,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admin_log (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action        TEXT NOT NULL,
  submission_id BIGINT,
  admin_user    TEXT,
  details       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE site_content (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'text',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
