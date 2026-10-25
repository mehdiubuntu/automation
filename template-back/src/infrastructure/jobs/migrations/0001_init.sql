-- Job queue and history, in schema "jobs". One row per job; this table IS the queue:
-- workers claim queued rows with FOR UPDATE SKIP LOCKED, so any number of workers can run side by side.
-- Plain SQL schemas (jobs and the engines) use snake_case; the core "platform" schema keeps the TypeORM names.
CREATE TABLE job_run (
  id               uuid PRIMARY KEY DEFAULT uuidv7(),
  engine           text        NOT NULL,
  type             text        NOT NULL,
  project_id       uuid        NOT NULL REFERENCES platform."Project" (id) ON DELETE RESTRICT,
  requested_by     uuid        REFERENCES platform."User" (id) ON DELETE SET NULL,
  input            jsonb       NOT NULL,
  status           text        NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  attempts         integer     NOT NULL DEFAULT 0,
  max_attempts     integer     NOT NULL CHECK (max_attempts >= 1),
  -- Earliest start: now() for a new job, later for a retry waiting out its backoff.
  run_at           timestamptz NOT NULL DEFAULT now(),
  -- Set while a worker holds the job. The lease is extended by heartbeats; an expired lease means the worker died.
  locked_by        text,
  locked_until     timestamptz,
  cancel_requested boolean     NOT NULL DEFAULT false,
  progress         smallint    CHECK (progress BETWEEN 0 AND 100),
  progress_note    text,
  result           jsonb,
  error            text,
  idempotency_key  text,
  correlation_id   text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  started_at       timestamptz,
  finished_at      timestamptz
);

CREATE INDEX job_run_claim ON job_run (engine, run_at) WHERE status = 'queued';
CREATE INDEX job_run_lease ON job_run (locked_until) WHERE status = 'running';
CREATE INDEX job_run_project ON job_run (project_id, created_at DESC);
CREATE INDEX job_run_finished ON job_run (finished_at) WHERE finished_at IS NOT NULL;
CREATE UNIQUE INDEX job_run_idempotency ON job_run (type, idempotency_key) WHERE idempotency_key IS NOT NULL;
