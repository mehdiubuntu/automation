-- Content engine tables. Runs inside the "content" schema: plain, unqualified SQL only.
-- Every generated text is a new immutable version: approval and publishing refer to one exact (id, content_hash).
CREATE TABLE article_version (
  id           uuid PRIMARY KEY DEFAULT uuidv7(),
  project_id   uuid        NOT NULL,
  job_id       uuid        NOT NULL UNIQUE,
  keyword      text        NOT NULL,
  version      integer     NOT NULL,
  title        text        NOT NULL,
  body         text        NOT NULL,
  content_hash text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX article_version_project ON article_version (project_id, keyword, version DESC);
