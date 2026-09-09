CREATE TABLE IF NOT EXISTS applications (
 id TEXT PRIMARY KEY,
 created_at TEXT NOT NULL,
 name TEXT NOT NULL,
 email TEXT NOT NULL,
 phone TEXT NOT NULL DEFAULT '',
 interests TEXT NOT NULL,
 experience TEXT NOT NULL DEFAULT '',
 privacy_notice TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS applications_created_at ON applications(created_at);
