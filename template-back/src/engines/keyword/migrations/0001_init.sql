-- Keyword engine tables. Runs inside the "keyword" schema: plain, unqualified SQL only.
CREATE TABLE research_run (
  id            uuid PRIMARY KEY DEFAULT uuidv7(),
  project_id    uuid        NOT NULL,
  job_id        uuid        NOT NULL UNIQUE,
  seed          text        NOT NULL,
  country       char(2)     NOT NULL,
  language      char(2)     NOT NULL,
  keyword_count integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- One row per keyword idea. Every metric keeps its own source and period; nothing is stored as a bare number.
CREATE TABLE keyword (
  id                 uuid PRIMARY KEY DEFAULT uuidv7(),
  run_id             uuid        NOT NULL REFERENCES research_run (id) ON DELETE CASCADE,
  project_id         uuid        NOT NULL,
  keyword            text        NOT NULL,
  source             text        NOT NULL,
  country            char(2)     NOT NULL,
  language           char(2)     NOT NULL,
  search_volume      integer,
  volume_source      text,
  volume_period      text,
  -- Google Ads "competition" = how many advertisers bid. It is NOT organic difficulty; the two never share a column.
  paid_competition   numeric(5, 4),
  organic_difficulty integer,
  collected_at       timestamptz NOT NULL,
  UNIQUE (run_id, keyword)
);

CREATE INDEX keyword_project ON keyword (project_id, keyword);
