-- Table to track already-processed Freshdesk tickets (deduplication)
CREATE TABLE IF NOT EXISTS processed_tickets (
  ticket_id BIGINT PRIMARY KEY,
  processed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE processed_tickets ENABLE ROW LEVEL SECURITY;
