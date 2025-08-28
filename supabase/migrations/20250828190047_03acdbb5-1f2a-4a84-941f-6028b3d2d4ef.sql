-- Move extensions from public schema to extensions schema
DROP EXTENSION IF EXISTS pg_cron CASCADE;
DROP EXTENSION IF EXISTS pg_net CASCADE;

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Install extensions in the extensions schema
CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Recreate the cron job using the extensions schema
SELECT extensions.cron.schedule(
  'auto-clockout-hourly',
  '0 * * * *', -- Run every hour at minute 0
  $$
  SELECT
    extensions.net.http_post(
        url:='https://npmniesphobtsoftczeh.supabase.co/functions/v1/auto-clockout',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wbW5pZXNwaG9idHNvZnRjemVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3OTc5ODYsImV4cCI6MjA2NjM3Mzk4Nn0.iTO3IXLxisUhosFZsE3cAo2oNsq8G6mWybSwjAGuJHQ"}'::jsonb,
        body:='{"time": "' || now() || '"}'::jsonb
    ) as request_id;
  $$
);