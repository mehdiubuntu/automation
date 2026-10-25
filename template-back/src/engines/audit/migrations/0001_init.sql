-- Audit engine tables. Runs inside the "audit" schema: plain, unqualified SQL only.
CREATE TABLE audit_run (
  id          uuid PRIMARY KEY DEFAULT uuidv7(),
  project_id  uuid        NOT NULL,
  job_id      uuid        NOT NULL UNIQUE,
  url         text        NOT NULL,
  status_code integer,
  score       integer     NOT NULL,
  findings    jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_run_project ON audit_run (project_id, created_at DESC);
