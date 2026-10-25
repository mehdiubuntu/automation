-- Runs inside this engine's own schema (named after the engine id): write plain, unqualified SQL.
-- Never mention another schema and never change search_path - the platform refuses such files.
-- A file is immutable once merged: put later changes in 0002_..., 0003_..., never edit this one.
CREATE TABLE example_run (
  id         uuid PRIMARY KEY DEFAULT uuidv7(),
  project_id uuid        NOT NULL,
  job_id     uuid        NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
