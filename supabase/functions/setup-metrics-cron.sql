-- Enable the required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the cron job to run every hour
SELECT cron.schedule(
  'collect-instance-metrics-hourly',
  '0 * * * *',  -- Run at minute 0 of every hour
  $$
  SELECT net.http_post(
    url:='https://vodexhppkasbulogmcqb.supabase.co/functions/v1/collect-instance-metrics',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_key') || '"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);