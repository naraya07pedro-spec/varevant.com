CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  tenant text NOT NULL,
  document_id text NOT NULL,
  source_key text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  fingerprint text NOT NULL,
  embedding_provider text NOT NULL,
  metadata jsonb NOT NULL,
  deleted boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant, document_id),
  UNIQUE (tenant, source_key),
  CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE chunks (
  tenant text NOT NULL,
  chunk_id text NOT NULL,
  document_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  span_start integer NOT NULL CHECK (span_start >= 0),
  span_end integer NOT NULL CHECK (span_end > span_start),
  content text NOT NULL,
  content_digest text NOT NULL,
  embedding vector(64) NOT NULL,
  PRIMARY KEY (tenant, chunk_id),
  FOREIGN KEY (tenant, document_id) REFERENCES documents (tenant, document_id),
  CHECK (span_end - span_start = char_length(content))
);
CREATE INDEX chunks_document ON chunks (tenant, document_id);
CREATE INDEX documents_metadata ON documents USING gin (metadata);

CREATE TABLE audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant text NOT NULL,
  subject text NOT NULL,
  operation text NOT NULL,
  outcome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
