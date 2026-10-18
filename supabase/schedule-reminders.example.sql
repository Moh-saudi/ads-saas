-- Optional manual deployment step; no actual secrets belong in this file.
-- Enable pg_cron and pg_net in Supabase first. In Vault create secrets named:
-- mesk_project_url: https://jdccaknvmenifhipskau.supabase.co
-- mesk_reminder_cron_secret: same value as REMINDER_CRON_SECRET in the Edge Function
-- Deploy whatsapp-reminders with the supplied function config and approved template first.
select cron.schedule('mesk-renewal-reminders','0 8 * * *',$job$
  select net.http_post(
    url:=(select decrypted_secret from vault.decrypted_secrets where name='mesk_project_url')||'/functions/v1/whatsapp-reminders',
    headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='mesk_reminder_cron_secret')),
    body:='{}'::jsonb
  );
$job$);
