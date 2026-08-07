-- 曜石质检 Online：在 Supabase SQL Editor 中完整执行
create extension if not exists pgcrypto;

create table if not exists public.profiles(
 auth_user_id uuid primary key references auth.users(id) on delete cascade,
 user_id text not null unique,
 role text not null check(role in('manager','inspector','promoter')),
 status text not null default 'ativo' check(status in('ativo','inativo')),
 display_name text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.promoters(
 id text primary key,
 nickname text not null,
 whatsapp text not null,
 inspection_count integer not null default 0 check(inspection_count>=0),
 last_inspected_at date,
 reputation_score numeric(10,2) check(reputation_score is null or reputation_score between 0 and 100),
 reputation_updated_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);

-- V3.2：为已经创建过的数据库补充最终信誉积分字段
alter table public.promoters add column if not exists reputation_score numeric(10,2);
alter table public.promoters add column if not exists reputation_updated_at timestamptz;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='promoters_reputation_score_check') then
  alter table public.promoters add constraint promoters_reputation_score_check check(reputation_score is null or reputation_score between 0 and 100);
 end if;
end $$;

create table if not exists public.inspectors(
 id text primary key,
 nickname text not null,
 current_phone text not null,
 target_tasks integer not null default 0 check(target_tasks>=0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.tasks(
 id uuid primary key default gen_random_uuid(),
 task_date date not null,
 week_start date not null,
 batch_id uuid not null,
 inspector_id text not null references public.inspectors(id),
 inspector_phone text not null,
 promoter_id text not null references public.promoters(id),
 status text not null default 'pending' check(status in('pending','in_progress','submitted','approved','changes_requested','weekly_unfinished','cancelled')),
 created_at timestamptz not null default now(),completed_at timestamptz,
 settled_at timestamptz
);
-- 只要任务未释放，相同号码 + 推广员就不能再次出现。完成任务永久占用；周结算未完成任务会被排除。
create unique index if not exists tasks_active_number_promoter_unique on public.tasks(inspector_phone,promoter_id)
 where status not in('weekly_unfinished','cancelled');
create index if not exists tasks_week_idx on public.tasks(week_start,inspector_id,status);

create table if not exists public.reports(
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null unique references public.tasks(id) on delete restrict,
 inspector_id text not null references public.inspectors(id),
 promoter_id text not null references public.promoters(id),
 promoter_status text not null,
 other_status_note text,
 rating text not null check(rating in('dissatisfied','neutral','satisfied')),
 reasons jsonb not null default '[]'::jsonb,
 other_reason_note text,
 summary text not null,
 evidence_url text not null,
 requires_follow_up boolean not null default false,
 review_status text not null default 'pending_review' check(review_status in('pending_review','approved','changes_requested')),
 manager_note text,
 submitted_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 reviewed_at timestamptz,reviewed_by text
);
create index if not exists reports_review_idx on public.reports(review_status,inspector_id,submitted_at);

create table if not exists public.leaderboard(
 id uuid primary key default gen_random_uuid(),week_start date not null,
 promoter_id text not null,promoter_name text not null,
 player_growth_score numeric not null default 0,reputation_score numeric not null default 0,
 weekly_rebate_score numeric not null default 0,total_score numeric not null default 0,rank integer not null,
 unique(week_start,promoter_id)
);
create table if not exists public.app_settings(
 id integer primary key default 1 check(id=1),board_size integer not null default 10,reputation_query_url text,updated_at timestamptz not null default now()
);
insert into public.app_settings(id,reputation_query_url) values(1,'https://cj2z2sudyqc.sg.larksuite.com/share/base/query/shrlglZIIuFiL9JExujF3KmTI6e') on conflict(id) do update set reputation_query_url=coalesce(public.app_settings.reputation_query_url,excluded.reputation_query_url);

create or replace function public.my_profile() returns public.profiles language sql stable security definer set search_path=public as $$
 select * from public.profiles where auth_user_id=auth.uid() and status='ativo' limit 1;
$$;
create or replace function public.is_manager() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where auth_user_id=auth.uid() and role='manager' and status='ativo');
$$;

alter table public.profiles enable row level security;alter table public.promoters enable row level security;alter table public.inspectors enable row level security;alter table public.tasks enable row level security;alter table public.reports enable row level security;alter table public.leaderboard enable row level security;alter table public.app_settings enable row level security;

drop policy if exists profiles_read on public.profiles;create policy profiles_read on public.profiles for select to authenticated using(auth_user_id=auth.uid() or public.is_manager());
drop policy if exists profiles_manager on public.profiles;create policy profiles_manager on public.profiles for all to authenticated using(public.is_manager()) with check(public.is_manager());

drop policy if exists promoters_read on public.promoters;create policy promoters_read on public.promoters for select to authenticated using(public.is_manager() or (select role from public.my_profile())='inspector' or id=(select user_id from public.my_profile()));
drop policy if exists promoters_manager on public.promoters;create policy promoters_manager on public.promoters for all to authenticated using(public.is_manager()) with check(public.is_manager());
drop policy if exists inspectors_read on public.inspectors;create policy inspectors_read on public.inspectors for select to authenticated using(public.is_manager() or id=(select user_id from public.my_profile()));
drop policy if exists inspectors_manager on public.inspectors;create policy inspectors_manager on public.inspectors for all to authenticated using(public.is_manager()) with check(public.is_manager());

drop policy if exists tasks_read on public.tasks;create policy tasks_read on public.tasks for select to authenticated using(public.is_manager() or inspector_id=(select user_id from public.my_profile()) or promoter_id=(select user_id from public.my_profile()));
drop policy if exists tasks_manager on public.tasks;create policy tasks_manager on public.tasks for all to authenticated using(public.is_manager()) with check(public.is_manager());
drop policy if exists tasks_inspector_update on public.tasks;create policy tasks_inspector_update on public.tasks for update to authenticated using(inspector_id=(select user_id from public.my_profile())) with check(inspector_id=(select user_id from public.my_profile()));

drop policy if exists reports_read on public.reports;create policy reports_read on public.reports for select to authenticated using(public.is_manager() or inspector_id=(select user_id from public.my_profile()) or promoter_id=(select user_id from public.my_profile()));
drop policy if exists reports_manager on public.reports;create policy reports_manager on public.reports for all to authenticated using(public.is_manager()) with check(public.is_manager());
drop policy if exists reports_inspector on public.reports;create policy reports_inspector on public.reports for insert to authenticated with check(inspector_id=(select user_id from public.my_profile()));
drop policy if exists reports_inspector_update on public.reports;create policy reports_inspector_update on public.reports for update to authenticated using(inspector_id=(select user_id from public.my_profile())) with check(inspector_id=(select user_id from public.my_profile()));

drop policy if exists leaderboard_read on public.leaderboard;create policy leaderboard_read on public.leaderboard for select to authenticated using(true);
drop policy if exists leaderboard_manager on public.leaderboard;create policy leaderboard_manager on public.leaderboard for all to authenticated using(public.is_manager()) with check(public.is_manager());
drop policy if exists settings_read on public.app_settings;create policy settings_read on public.app_settings for select to authenticated using(true);
drop policy if exists settings_manager on public.app_settings;create policy settings_manager on public.app_settings for all to authenticated using(public.is_manager()) with check(public.is_manager());

create or replace view public.task_details with(security_invoker=true) as
 select t.*,p.nickname promoter_name,p.whatsapp,i.nickname inspector_name from public.tasks t join public.promoters p on p.id=t.promoter_id join public.inspectors i on i.id=t.inspector_id;
create or replace view public.report_details with(security_invoker=true) as
 select r.*,t.task_date,t.week_start,t.inspector_phone,p.nickname promoter_name,i.nickname inspector_name
 from public.reports r join public.tasks t on t.id=r.task_id join public.promoters p on p.id=r.promoter_id join public.inspectors i on i.id=r.inspector_id;

grant select on public.task_details,public.report_details to authenticated;

-- 预览分配，不写入数据
create or replace function public.preview_allocation(p_task_date date,p_requests jsonb)
returns table(inspector_id text,inspector_name text,phone text,promoter_id text,promoter_name text)
language plpgsql security definer set search_path=public as $$
declare req jsonb; cand record; needed int;begin
 if not public.is_manager() then raise exception '无权限';end if;
 for req in select * from jsonb_array_elements(p_requests) loop
  needed:=(req->>'count')::int;
  if needed<=0 then continue;end if;
  for cand in
   select p.id,p.nickname from promoters p
   where not exists(select 1 from tasks t where t.inspector_phone=req->>'phone' and t.promoter_id=p.id and t.status not in('weekly_unfinished','cancelled'))
   order by p.inspection_count asc,p.last_inspected_at nulls first,p.id asc limit needed
  loop
   inspector_id:=req->>'inspector_id';phone:=req->>'phone';promoter_id:=cand.id;promoter_name:=cand.nickname;
   select nickname into inspector_name from inspectors where id=inspector_id;return next;
  end loop;
  if (select count(*) from promoters p where not exists(select 1 from tasks t where t.inspector_phone=req->>'phone' and t.promoter_id=p.id and t.status not in('weekly_unfinished','cancelled'))) < needed then
   raise exception '质检员 % 的号码 % 可用推广员不足',req->>'inspector_id',req->>'phone';
  end if;
 end loop;
end$$;

create or replace function public.create_allocation_batch(p_task_date date,p_requests jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare batch uuid:=gen_random_uuid();req jsonb;cand record;needed int;created int:=0;begin
 if not public.is_manager() then raise exception '无权限';end if;
 for req in select * from jsonb_array_elements(p_requests) loop
  needed:=(req->>'count')::int;if needed<=0 then continue;end if;
  if not exists(select 1 from inspectors where id=req->>'inspector_id') then raise exception '质检员不存在';end if;
  if (select count(*) from promoters p where not exists(select 1 from tasks t where t.inspector_phone=req->>'phone' and t.promoter_id=p.id and t.status not in('weekly_unfinished','cancelled'))) < needed then raise exception '号码可用推广员不足';end if;
  for cand in select p.id from promoters p where not exists(select 1 from tasks t where t.inspector_phone=req->>'phone' and t.promoter_id=p.id and t.status not in('weekly_unfinished','cancelled')) order by p.inspection_count,p.last_inspected_at nulls first,p.id limit needed loop
   insert into tasks(task_date,week_start,batch_id,inspector_id,inspector_phone,promoter_id) values(p_task_date,date_trunc('week',p_task_date)::date,batch,req->>'inspector_id',req->>'phone',cand.id);created:=created+1;
  end loop;
  update inspectors set current_phone=req->>'phone',updated_at=now() where id=req->>'inspector_id';
 end loop;return jsonb_build_object('batch_id',batch,'created_count',created);
end$$;

-- 首次提交报告时才增加推广员累计质检次数；重复提交/修改不会重复增加
create or replace function public.submit_inspection_report(p_task_id uuid,p_promoter_status text,p_rating text,p_reasons jsonb,p_summary text,p_evidence_url text,p_requires_follow_up boolean,p_other_status_note text default null,p_other_reason_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare t tasks%rowtype;rid uuid;first_submit boolean;begin
 select * into t from tasks where id=p_task_id for update;if not found then raise exception '任务不存在';end if;
 if t.inspector_id<>(select user_id from my_profile()) and not is_manager() then raise exception '无权限';end if;
 if t.status in('weekly_unfinished','cancelled','approved') then raise exception '该任务不可提交';end if;
 first_submit:=not exists(select 1 from reports where task_id=p_task_id);
 insert into reports(task_id,inspector_id,promoter_id,promoter_status,other_status_note,rating,reasons,other_reason_note,summary,evidence_url,requires_follow_up,review_status,submitted_at,updated_at)
 values(p_task_id,t.inspector_id,t.promoter_id,p_promoter_status,p_other_status_note,p_rating,p_reasons,p_other_reason_note,p_summary,p_evidence_url,p_requires_follow_up,'pending_review',now(),now())
 on conflict(task_id) do update set promoter_status=excluded.promoter_status,other_status_note=excluded.other_status_note,rating=excluded.rating,reasons=excluded.reasons,other_reason_note=excluded.other_reason_note,summary=excluded.summary,evidence_url=excluded.evidence_url,requires_follow_up=excluded.requires_follow_up,review_status='pending_review',updated_at=now(),manager_note=null,reviewed_at=null,reviewed_by=null returning id into rid;
 update tasks set status='submitted',completed_at=coalesce(completed_at,now()) where id=p_task_id;
 if first_submit then update promoters set inspection_count=inspection_count+1,last_inspected_at=t.task_date,updated_at=now() where id=t.promoter_id;end if;
 return rid;
end$$;

create or replace function public.review_inspection_report(p_report_id uuid,p_review_status text,p_manager_note text default null) returns void
language plpgsql security definer set search_path=public as $$
declare tid uuid;begin if not is_manager() then raise exception '无权限';end if;if p_review_status not in('approved','changes_requested') then raise exception '审核状态无效';end if;
 update reports set review_status=p_review_status,manager_note=p_manager_note,reviewed_at=now(),reviewed_by=(select user_id from my_profile()),updated_at=now() where id=p_report_id returning task_id into tid;
 update tasks set status=p_review_status where id=tid;end$$;

create or replace function public.preview_weekly_settlement(p_week_start date)
returns table(inspector_id text,inspector_name text,target_tasks int,assigned bigint,completed bigint,remaining bigint,historical_unfinished bigint)
language sql security definer set search_path=public as $$
 select i.id,i.nickname,i.target_tasks,
 count(t.id) filter(where t.week_start=p_week_start),
 count(t.id) filter(where t.week_start=p_week_start and t.status in('submitted','approved','changes_requested')),
 count(t.id) filter(where t.week_start=p_week_start and t.status in('pending','in_progress')),
 count(t.id) filter(where t.week_start<p_week_start and t.status='weekly_unfinished')
 from inspectors i left join tasks t on t.inspector_id=i.id
 where is_manager() group by i.id,i.nickname,i.target_tasks order by i.nickname;
$$;
create or replace function public.settle_week(p_week_start date) returns jsonb language plpgsql security definer set search_path=public as $$
declare n int;begin if not is_manager() then raise exception '无权限';end if;
 update tasks set status='weekly_unfinished',settled_at=now() where week_start=p_week_start and status in('pending','in_progress');get diagnostics n=row_count;
 return jsonb_build_object('released_count',n);end$$;

grant execute on function public.preview_allocation(date,jsonb),public.create_allocation_batch(date,jsonb),public.submit_inspection_report(uuid,text,text,jsonb,text,text,boolean,text,text),public.review_inspection_report(uuid,text,text),public.preview_weekly_settlement(date),public.settle_week(date) to authenticated;
