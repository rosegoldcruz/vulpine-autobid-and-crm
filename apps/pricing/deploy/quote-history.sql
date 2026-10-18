CREATE TABLE IF NOT EXISTS pricing_projects (
 org text NOT NULL, project_key text NOT NULL, name text NOT NULL,
 deleted_at timestamptz, PRIMARY KEY(org,project_key)
);
CREATE TABLE IF NOT EXISTS pricing_quotes (
 id uuid PRIMARY KEY, org text NOT NULL, project_key text NOT NULL,
 project_name text NOT NULL, quote_number text NOT NULL, state jsonb NOT NULL,
 revision integer NOT NULL, created_by text NOT NULL, updated_by text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pricing_quotes_projects ON pricing_quotes(org,project_key,updated_at DESC);
CREATE TABLE IF NOT EXISTS pricing_quote_revisions (
 quote_id uuid NOT NULL REFERENCES pricing_quotes(id), revision integer NOT NULL,
 org text NOT NULL, state jsonb NOT NULL, actor text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(quote_id,revision)
);
CREATE TABLE IF NOT EXISTS pricing_quote_exports (
 id uuid PRIMARY KEY, quote_id uuid NOT NULL REFERENCES pricing_quotes(id), revision integer NOT NULL,
 org text NOT NULL, type text NOT NULL, format text NOT NULL, bytes bytea NOT NULL,
 created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pricing_quote_exports_quote ON pricing_quote_exports(org,quote_id,created_at DESC);

CREATE TABLE IF NOT EXISTS pricing_quote_deletions (
 quote_id uuid PRIMARY KEY, org text NOT NULL, actor text NOT NULL,
 revision integer NOT NULL, deleted_at timestamptz NOT NULL DEFAULT now()
);
