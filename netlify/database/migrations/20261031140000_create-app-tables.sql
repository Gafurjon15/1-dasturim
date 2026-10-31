CREATE TABLE IF NOT EXISTS app_users (
    id text PRIMARY KEY,
    identifier text NOT NULL UNIQUE,
    label text NOT NULL,
    name text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_sessions (
    token_hash text PRIMARY KEY,
    user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS app_sessions_expiry_idx ON app_sessions (expires_at);

CREATE TABLE IF NOT EXISTS app_user_data (
    user_id text PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
    data jsonb NOT NULL DEFAULT '{"purchases":[],"sales":[],"workers":[],"extras":[]}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
);
