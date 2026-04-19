-- Blackpool AI — Phase 1 schema, RLS, and storage (see APP_BLUEPRINT.md)

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.leads (
  id uuid primary key default gen_random_uuid (),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id) on delete cascade,
  business_name text not null,
  website_url text not null,
  category text not null,
  status text not null default 'draft',
  constraint leads_status_check check (
    status in ('draft', 'ready_for_video', 'video_ready', 'error')
  )
);

create table public.video_jobs (
  id uuid primary key default gen_random_uuid (),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  status text not null default 'pending',
  ltx_job_id text,
  error_message text,
  render_storage_path text,
  prompt_snapshot text,
  constraint video_jobs_status_check check (
    status in ('pending', 'processing', 'completed', 'failed')
  )
);

create index leads_created_by_idx on public.leads (created_by);

create index video_jobs_lead_id_idx on public.video_jobs (lead_id);

create table public.assets (
  id uuid primary key default gen_random_uuid (),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  type text not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  metadata jsonb,
  constraint assets_type_check check (type in ('logo', 'screenshot', 'other')),
  constraint assets_storage_bucket_check check (
    storage_bucket in ('logos', 'screenshots', 'renders')
  )
);

create index assets_lead_id_idx on public.assets (lead_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at ()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_set_updated_at
before update on public.leads
for each row
execute function public.set_updated_at ();

create trigger video_jobs_set_updated_at
before update on public.video_jobs
for each row
execute function public.set_updated_at ();

create trigger assets_set_updated_at
before update on public.assets
for each row
execute function public.set_updated_at ();

-- ---------------------------------------------------------------------------
-- Row Level Security (tables)
-- ---------------------------------------------------------------------------

alter table public.leads enable row level security;
alter table public.video_jobs enable row level security;
alter table public.assets enable row level security;

create policy "Users select own leads"
on public.leads
for select
using (created_by = (select auth.uid()));

create policy "Users insert own leads"
on public.leads
for insert
with check (created_by = (select auth.uid()));

create policy "Users update own leads"
on public.leads
for update
using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));

create policy "Users delete own leads"
on public.leads
for delete
using (created_by = (select auth.uid()));

create policy "Users select video_jobs for own leads"
on public.video_jobs
for select
using (
  exists (
    select 1
    from public.leads
    where leads.id = video_jobs.lead_id
      and leads.created_by = (select auth.uid())
  )
);

create policy "Users insert video_jobs for own leads"
on public.video_jobs
for insert
with check (
  exists (
    select 1
    from public.leads
    where leads.id = video_jobs.lead_id
      and leads.created_by = (select auth.uid())
  )
);

create policy "Users update video_jobs for own leads"
on public.video_jobs
for update
using (
  exists (
    select 1
    from public.leads
    where leads.id = video_jobs.lead_id
      and leads.created_by = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.leads
    where leads.id = video_jobs.lead_id
      and leads.created_by = (select auth.uid())
  )
);

create policy "Users delete video_jobs for own leads"
on public.video_jobs
for delete
using (
  exists (
    select 1
    from public.leads
    where leads.id = video_jobs.lead_id
      and leads.created_by = (select auth.uid())
  )
);

create policy "Users select assets for own leads"
on public.assets
for select
using (
  exists (
    select 1
    from public.leads
    where leads.id = assets.lead_id
      and leads.created_by = (select auth.uid())
  )
);

create policy "Users insert assets for own leads"
on public.assets
for insert
with check (
  exists (
    select 1
    from public.leads
    where leads.id = assets.lead_id
      and leads.created_by = (select auth.uid())
  )
);

create policy "Users update assets for own leads"
on public.assets
for update
using (
  exists (
    select 1
    from public.leads
    where leads.id = assets.lead_id
      and leads.created_by = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.leads
    where leads.id = assets.lead_id
      and leads.created_by = (select auth.uid())
  )
);

create policy "Users delete assets for own leads"
on public.assets
for delete
using (
  exists (
    select 1
    from public.leads
    where leads.id = assets.lead_id
      and leads.created_by = (select auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- Storage buckets (private)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('logos', 'logos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('renders', 'renders', false)
on conflict (id) do nothing;

-- Path convention: {lead_id}/{filename...} — ownership via public.leads

create policy "Owner can read own lead files"
on storage.objects
for select
to authenticated
using (
  bucket_id in ('logos', 'screenshots', 'renders')
  and exists (
    select 1
    from public.leads
    where
      leads.id = split_part (storage.objects.name, '/', 1)::uuid
      and leads.created_by = (select auth.uid())
  )
);

create policy "Owner can upload to own lead prefix"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('logos', 'screenshots', 'renders')
  and exists (
    select 1
    from public.leads
    where
      leads.id = split_part (storage.objects.name, '/', 1)::uuid
      and leads.created_by = (select auth.uid())
  )
);

create policy "Owner can update own lead files"
on storage.objects
for update
to authenticated
using (
  bucket_id in ('logos', 'screenshots', 'renders')
  and exists (
    select 1
    from public.leads
    where
      leads.id = split_part (storage.objects.name, '/', 1)::uuid
      and leads.created_by = (select auth.uid())
  )
)
with check (
  bucket_id in ('logos', 'screenshots', 'renders')
  and exists (
    select 1
    from public.leads
    where
      leads.id = split_part (storage.objects.name, '/', 1)::uuid
      and leads.created_by = (select auth.uid())
  )
);

create policy "Owner can delete own lead files"
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('logos', 'screenshots', 'renders')
  and exists (
    select 1
    from public.leads
    where
      leads.id = split_part (storage.objects.name, '/', 1)::uuid
      and leads.created_by = (select auth.uid())
  )
);
