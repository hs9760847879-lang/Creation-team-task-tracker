-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/ilrzyvrxxxtiwfoupera/sql)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove old schedule if exists (had wrong token)
SELECT cron.unschedule('poll-freshdesk');

-- Schedule poll-freshdesk every 15 minutes with correct CRON_SECRET
SELECT cron.schedule(
  'poll-freshdesk',
  '*/15 * * * *',
  $$
  SELECT net.http_get(
    url:='https://ilrzyvrxxxtiwfoupera.supabase.co/functions/v1/poll-freshdesk?token=poll-secret-abc123',
    headers:='{}'::jsonb
  )
  $$
);

-- To view scheduled jobs: SELECT * FROM cron.job;
-- To unschedule: SELECT cron.unschedule('poll-freshdesk');
