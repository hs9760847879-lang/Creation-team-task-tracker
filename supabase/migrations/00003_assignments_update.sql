-- Add mail_slack_link column to assignments
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS mail_slack_link TEXT;

-- Drop existing status constraint and recreate with new statuses
ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_status_check;
ALTER TABLE assignments ADD CONSTRAINT assignments_status_check
  CHECK (status IN ('not_started', 'pending', 'in-progress', 'completed', 'pending_approval', 'need_help', 'waiting_on_kam'));

-- Change default status to not_started
ALTER TABLE assignments ALTER COLUMN status SET DEFAULT 'not_started';

-- Add a Freshdesk default task type
INSERT INTO tasks (title, type, is_active) VALUES ('Freshdesk Ticket', 'default', true)
ON CONFLICT (title) DO NOTHING;
