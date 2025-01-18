select
  cron.schedule(
    'process-ai-follow-up-every-minute',
    '* * * * *',
    $$
    select
      net.http_post(
        url:='https://vodexhppkasbulogmcqb.supabase.co/functions/v1/process-ai-follow-up',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_key') || '"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
      ) as request_id;
    $$
  );