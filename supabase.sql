-- Run once in your Supabase project's SQL editor.
create table if not exists public.ftm_scores (
  id bigint generated always as identity primary key,
  name text not null,
  name_key text not null,
  date text not null,
  mode text not null check (mode in ('easy','hard')),
  kicker boolean not null,
  score numeric(9,1) not null check (score >= 0),
  updated_at timestamptz not null default now(),
  unique(name_key,date,mode,kicker)
);
alter table public.ftm_scores enable row level security;
-- No public table policies. Only the server's service-role key can access this table.
create or replace function public.ftm_submit_best(p_name text,p_date text,p_mode text,p_kicker boolean,p_score numeric)
returns void language plpgsql security invoker set search_path=public as $$
begin
 insert into public.ftm_scores(name,name_key,date,mode,kicker,score)
 values(p_name,lower(p_name),p_date,p_mode,p_kicker,p_score)
 on conflict(name_key,date,mode,kicker)
 do update set score=excluded.score,name=excluded.name,updated_at=now()
 where ftm_scores.score < excluded.score;
end;
$$;
revoke all on function public.ftm_submit_best(text,text,text,boolean,numeric) from public,anon,authenticated;
grant execute on function public.ftm_submit_best(text,text,text,boolean,numeric) to service_role;
