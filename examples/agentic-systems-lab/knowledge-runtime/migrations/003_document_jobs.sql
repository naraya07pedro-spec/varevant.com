CREATE TABLE document_jobs (
  tenant text NOT NULL,
  job_id text NOT NULL,
  source_key text NOT NULL,
  content_digest text NOT NULL,
  mime text NOT NULL,
  pipeline_version text NOT NULL,
  state text NOT NULL CHECK (state IN (
    'PROCESSING','EXTRACTED','MANUAL_REVIEW','FAILED_TRANSIENT','FAILED_PERMANENT'
  )),
  attempts integer NOT NULL CHECK (attempts BETWEEN 1 AND 3),
  owner_token text NOT NULL,
  lease_until timestamptz NOT NULL,
  raw_text text,
  result jsonb,
  quality double precision CHECK (quality BETWEEN 0 AND 1),
  reason text,
  providers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(tenant,job_id),
  CHECK (result IS NULL OR jsonb_typeof(result)='object'),
  CHECK (jsonb_typeof(providers)='object')
);

CREATE TABLE document_handoffs (
  tenant text NOT NULL,
  job_id text NOT NULL,
  state text NOT NULL CHECK (state='READY'),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(tenant,job_id),
  FOREIGN KEY(tenant,job_id) REFERENCES document_jobs(tenant,job_id),
  CHECK (jsonb_typeof(payload)='object')
);
