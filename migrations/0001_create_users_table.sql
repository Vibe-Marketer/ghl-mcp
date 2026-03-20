-- Migration: Create users table for MCP access control
-- Run: npx wrangler d1 execute ghl-accounts --remote --file=migrations/0001_create_users_table.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  api_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  scopes TEXT NOT NULL DEFAULT '["*"]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT
);
