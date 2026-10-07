CREATE TABLE customers (
  tenant text NOT NULL,
  customer_id text NOT NULL,
  display_name text NOT NULL,
  recipient text NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  verified boolean NOT NULL DEFAULT false,
  suppressed boolean NOT NULL DEFAULT false,
  PRIMARY KEY(tenant,customer_id)
);

CREATE TABLE followup_proposals (
  tenant text NOT NULL,
  proposal_id text NOT NULL,
  business_key text NOT NULL,
  customer_id text NOT NULL,
  requester text NOT NULL,
  request_hash text NOT NULL,
  target_revision integer NOT NULL,
  target_recipient text NOT NULL,
  message text NOT NULL,
  state text NOT NULL CHECK (state IN ('PENDING','APPROVED','REJECTED','EXPIRED')),
  reviewer text,
  expires_at timestamptz NOT NULL DEFAULT clock_timestamp() + interval '15 minutes',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(tenant,proposal_id),
  UNIQUE(tenant,business_key),
  FOREIGN KEY(tenant,customer_id) REFERENCES customers(tenant,customer_id)
);

CREATE TABLE workflow_outbox (
  tenant text NOT NULL,
  handoff_id text NOT NULL,
  proposal_id text NOT NULL,
  state text NOT NULL CHECK (state='READY'),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(tenant,handoff_id),
  UNIQUE(tenant,proposal_id),
  FOREIGN KEY(tenant,proposal_id) REFERENCES followup_proposals(tenant,proposal_id),
  CHECK (jsonb_typeof(payload)='object')
);
