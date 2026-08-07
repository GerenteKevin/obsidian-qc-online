-- 在已经运行过旧 schema.sql 的 Supabase 项目中执行此文件
alter table public.promoters add column if not exists reputation_score numeric(10,2);
alter table public.promoters add column if not exists reputation_updated_at timestamptz;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='promoters_reputation_score_check') then
  alter table public.promoters add constraint promoters_reputation_score_check check(reputation_score is null or reputation_score between 0 and 100);
 end if;
end $$;
alter table public.app_settings add column if not exists reputation_query_url text;
update public.app_settings
set reputation_query_url='https://cj2z2sudyqc.sg.larksuite.com/share/base/query/shrlglZIIuFiL9JExujF3KmTI6e', updated_at=now()
where id=1;
