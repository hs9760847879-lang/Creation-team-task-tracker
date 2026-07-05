-- Add freshdesk_agent_id to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS freshdesk_agent_id BIGINT UNIQUE;

-- Track (ticket_id, responder_id) pairs to handle reassignments
DROP TABLE IF EXISTS processed_tickets;
CREATE TABLE processed_tickets (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL,
  responder_id BIGINT DEFAULT 0 NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX processed_tickets_unique_pair ON processed_tickets (ticket_id, responder_id);

ALTER TABLE processed_tickets ENABLE ROW LEVEL SECURITY;
