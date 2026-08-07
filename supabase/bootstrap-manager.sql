-- 先在 Supabase Dashboard > Authentication > Users 创建：
-- Email: 1001@qc.local
-- Password: Gerente@2026
-- 然后将下面 YOUR_AUTH_USER_UUID 替换为该用户 UUID 再执行。
insert into public.profiles(auth_user_id,user_id,role,status,display_name)
values('YOUR_AUTH_USER_UUID','1001','manager','ativo','经理 1001')
on conflict(user_id) do update set auth_user_id=excluded.auth_user_id,role='manager',status='ativo',display_name='经理 1001';
