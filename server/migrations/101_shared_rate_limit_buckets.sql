-- Shared PostgreSQL-backed API and login rate-limit buckets.
-- Keys are SHA-256 digests so raw client IPs and login identifiers are not
-- stored in this operational table. The application role owns this table.
CREATE TABLE IF NOT EXISTS gabah_rate_limit_buckets (
  bucket_type TEXT NOT NULL CHECK (bucket_type IN ('api', 'login')),
  bucket_key CHAR(64) NOT NULL CHECK (bucket_key ~ '^[0-9a-f]{64}$'),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bucket_type, bucket_key)
);

CREATE INDEX IF NOT EXISTS idx_gabah_rate_limit_buckets_updated_at
  ON gabah_rate_limit_buckets (updated_at);

COMMENT ON TABLE gabah_rate_limit_buckets IS
  'Shared API and login rate-limit state. bucket_key stores a SHA-256 digest, not raw IP/email identifiers.';
