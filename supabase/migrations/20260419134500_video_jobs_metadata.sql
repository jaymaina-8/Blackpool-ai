-- Phase 5: optional JSON metadata on video_jobs (model id, duration, etc.)

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'video_jobs'
      and column_name = 'metadata'
  ) then
    alter table public.video_jobs add column metadata jsonb;
  end if;
end $$;
