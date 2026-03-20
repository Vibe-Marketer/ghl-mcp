-- Add allowed_accounts column to users table
-- ["*"] = all accounts, specific location IDs = restricted access
ALTER TABLE users ADD COLUMN allowed_accounts TEXT NOT NULL DEFAULT '["*"]';
