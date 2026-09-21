CREATE TABLE IF NOT EXISTS sync_accounts (
  owner_id TEXT PRIMARY KEY,
  sync_code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_accounts_code ON sync_accounts(sync_code);
