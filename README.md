# 曜石质检 Online

这是 Supabase 在线数据库版本。任务、报告、排行榜和账号权限不再依赖浏览器 localStorage。

## 最终业务规则

1. 分配任务时，占用 `质检号码 + 推广员ID`，但推广员累计质检次数不增加。
2. 质检员首次提交完整报告后，推广员累计质检次数才增加 1。
3. 经理审核不会再次增加次数。
4. 周结算把仍为“待执行/进行中”的任务改为“本周未完成”，释放号码组合。
5. 本周未完成任务永久保留在历史统计中，但相同号码以后可以再次分配给该推广员。
6. 已提交、需要修改或审核通过的任务永久占用该号码组合。

## 1. 创建 Supabase

1. 新建 Supabase 项目。
2. 打开 SQL Editor，完整执行 `supabase/schema.sql`。
3. 打开 Authentication > Users，创建第一个经理用户：
   - Email: `1001@qc.local`
   - Password: `Gerente@2026`
4. 复制该用户 UUID，编辑并执行 `supabase/bootstrap-manager.sql`。

## 2. 部署账号导入函数

安装 Supabase CLI 后：

```bash
supabase login
supabase link --project-ref 你的项目ref
supabase functions deploy import-accounts
```

Edge Function 会自动使用项目的 `SUPABASE_SERVICE_ROLE_KEY`。不要把 service role key 放进前端 `.env`。

## 3. 本地运行

复制环境变量：

```powershell
Copy-Item .env.example .env
```

填写：

```env
VITE_SUPABASE_URL=https://你的项目.supabase.co
VITE_SUPABASE_ANON_KEY=你的 publishable 或 anon key
```

安装和运行：

```powershell
npm.cmd install
npm.cmd run dev
```

## 4. 导入顺序

先登录经理账号，然后依次导入：

1. `examples/promoters.csv`
2. `examples/inspectors.csv`
3. `examples/accounts.csv`
4. `examples/leaderboard.csv`

账号 CSV：

```csv
user_id,password,role,status
1001,Gerente@2026,gerente,ativo
10820570,Promoter@2026,promotor,ativo
Q001,Inspector@2026,inspetor,ativo
```

## 5. 上线到 Vercel

1. 将项目推送到 GitHub。
2. 在 Vercel 导入仓库。
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. 添加环境变量 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。
6. 重新部署。

## 安全说明

- 密码由 Supabase Auth 哈希保存，前端数据库表不保存明文密码。
- 账号 CSV 只在经理调用 Edge Function 时传输。
- 数据表启用了 RLS。
- 分配、报告提交、审核和周结算使用 PostgreSQL 函数事务执行。

## V3.2 信誉积分模块

如果你的 Supabase 已经运行过旧版 `schema.sql`，请在 SQL Editor 执行：

```text
supabase/migrations/20260806_add_reputation.sql
```

经理端新增“信誉积分”页面，导入格式：

```csv
promoter_id,reputation_score
10820570,95
```

推广员登录后只能查看自己的最终信誉积分和统一查询链接。原推广员 CSV 不变。
