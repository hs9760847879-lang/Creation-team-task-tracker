-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/ilrzyvrxxxtiwfoupera/sql)
-- BEFORE running: replace YOUR_CRON_SECRET with the value you set for CRON_SECRET in Edge Function secrets

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule poll-freshdesk every 15 minutes
-- IMPORTANT: Replace YOUR_CRON_SECRET below with the actual CRON_SECRET value
SELECT cron.schedule(
  'poll-freshdesk',
  '*/15 * * * *',
  $$
  SELECT net.http_get(
    url:='https://ilrzyvrxxxtiwfoupera.supabase.co/functions/v1/poll-freshdesk?token=YOUR_CRON_SECRET',
    headers:='{}'::jsonb
  )
  $$
);

-- To view scheduled jobs: SELECT * FROM cron.job;
-- To unschedule: SELECT cron.unschedule('poll-freshdesk');
