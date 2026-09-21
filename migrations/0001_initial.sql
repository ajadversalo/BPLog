PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS medication_groups (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_medication_groups_owner ON medication_groups(owner_id, created_at);

CREATE TABLE IF NOT EXISTS medications (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  dose TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (group_id) REFERENCES medication_groups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_medications_group ON medications(group_id, position);

CREATE TABLE IF NOT EXISTS reading_sessions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  reading_time TEXT NOT NULL,
  created_at TEXT NOT NULL,
  average_systolic INTEGER NOT NULL,
  average_diastolic INTEGER NOT NULL,
  reading_count INTEGER NOT NULL,
  FOREIGN KEY (group_id) REFERENCES medication_groups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reading_sessions_owner ON reading_sessions(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS blood_pressure_readings (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  systolic INTEGER NOT NULL,
  diastolic INTEGER NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (session_id) REFERENCES reading_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_blood_pressure_readings_session ON blood_pressure_readings(session_id, position);
