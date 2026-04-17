# 🔴 Ofiere — Production Readiness Audit

> **Audit Date:** April 9, 2026  
> **Auditor:** Antigravity AI (Claude Opus 4.6)  
> **Sources:** GitHub MCP, Vercel MCP, Supabase MCP, Local Codebase  
> **Verdict: NOT READY FOR PRODUCTION** — Critical security, codebase hygiene, and infrastructure issues must be resolved first.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [🔴 CRITICAL — Secrets & Credentials Exposure](#2--critical--secrets--credentials-exposure)
3. [🔴 CRITICAL — Supabase Security Issues](#3--critical--supabase-security-issues)
4. [🟡 HIGH — Codebase Hygiene](#4--high--codebase-hygiene)
5. [🟡 HIGH — Vercel Deployment Issues](#5--high--vercel-deployment-issues)
6. [🟡 HIGH — Database Performance Issues](#6--high--database-performance-issues)
7. [🟠 MEDIUM — Application Architecture](#7--medium--application-architecture)
8. [🔵 LOW — Code Quality & Best Practices](#8--low--code-quality--best-practices)
9. [Checklist Summary](#9-checklist-summary)

---

## 1. Executive Summary

| Category | Status | Critical Issues |
|---|---|---|
| **Security** | 🔴 FAIL | Secrets in `.env.local`, public repo exposure, missing RLS policies, overly permissive policies |
| **Codebase Hygiene** | 🟡 WARN | 60+ junk files in dashboard root, debug scripts committed |
| **Vercel Deployment** | 🟢 OK (with caveats) | Builds successfully, but 3/20 historical deployments failed |
| **Supabase Database** | 🟡 WARN | 9 tables missing RLS policies, 9 tables with `USING (true)` bypass, 40+ RLS performance issues |
| **Architecture** | 🟠 INFO | `reactStrictMode: false`, debug `console.log` in auth, no error boundaries |
| **GitHub** | 🟡 WARN | Public repository exposes architecture docs, no branch protection |

---

## 2. 🔴 CRITICAL — Secrets & Credentials Exposure

### Problem
The `.env.local` file contains **hardcoded secrets, API keys, and passwords**. While `.env.local` is in `.gitignore` and won't be pushed to GitHub, there are several compounding risks:

| Secret | Risk |
|---|---|
| `OPENCLAW_AUTH_TOKEN=tHu1pVua4nosFlCTXREgDRbrBkGiyQqa` | VPS auth token — if leaked, grants full access to your OpenClaw backend |
| `AGENT_ZERO_API_KEY=H7hBNUqom_ESopBO` | Agent Zero API key |
| `AGENT_ZERO_USERNAME=gilanggema` / `AGENT_ZERO_PASSWORD=Dotexe1996` | **Plaintext username/password** stored in env file |
| `SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...` | Service role key — **full database access bypassing RLS** |
| `COMPOSIO_API_KEY=ak_6JfmLwWBByDmd18yGlMi` | Third-party API key |

### Additional Risk: `OFIERE_ENCRYPTION_KEY` Not Set
The `lib/encryption.ts` file falls back to a **deterministic default key** derived from `'nerv-os-default-key-change-me'`. This means all encrypted secrets in the database (connection profiles, API keys) are encrypted with a publicly-known key.

### Solution

```bash
# 1. Generate a proper encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Set it in Vercel Environment Variables (NOT in .env.local for production)
# Go to: Vercel Dashboard → nerv → Settings → Environment Variables
# Add: OFIERE_ENCRYPTION_KEY = <generated_key>

# 3. Rotate ALL secrets that may have been exposed:
#    - Regenerate OPENCLAW_AUTH_TOKEN on your VPS
#    - Regenerate AGENT_ZERO_API_KEY
#    - Change AGENT_ZERO_PASSWORD
#    - Regenerate COMPOSIO_API_KEY
#    - Consider regenerating Supabase anon key if it was ever shared publicly

# 4. NEVER store passwords in env files. Use a vault or OAuth.
```

### Verify Environment Variables in Vercel
Ensure all required env vars are set in Vercel's dashboard (Settings → Environment Variables) for the `production` environment. Currently confirmed env vars need to include:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OFIERE_ENCRYPTION_KEY`
- `NEXT_PUBLIC_OPENCLAW_WS_URL`
- `NEXT_PUBLIC_OPENCLAW_HTTP_URL`
- `OPENCLAW_AUTH_TOKEN`

---

## 3. 🔴 CRITICAL — Supabase Security Issues

### 3a. Tables with RLS Enabled but NO Policies (9 tables)

These tables have RLS turned on but **zero policies defined**, which means **no one can access them** (not even authenticated users). This either breaks features or, if bypassed with service role, provides no protection.

| Table | Data Rows |
|---|---|
| `companion_memories` | 190 |
| `companion_world_memories` | 175 |
| `constellations` | 0 |
| `pentagram_chat_history` | 142 |
| `pentagram_custom_choices` | 6 |
| `pentagram_custom_scenes` | 1 |
| `pentagram_saves` | 0 |
| `summit_messages` | 6 |
| `summit_sessions` | 1 |

#### Solution

```sql
-- For each table, add a user-scoped policy. Example for companion_memories:
CREATE POLICY "Users can manage own companion memories"
ON public.companion_memories
FOR ALL
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

-- Repeat for all 9 tables above, adjusting the user_id column reference as needed.
-- Note: summit_sessions and summit_messages use a TEXT user_id column,
-- so cast accordingly: USING ((select auth.uid())::text = user_id)
```

### 3b. Tables with Overly Permissive Policies — `USING (true)` (9 tables)

These tables have RLS policies that use `USING (true)` and `WITH CHECK (true)`, which **completely bypasses RLS** — any anonymous or authenticated user can read/write/delete all data.

| Table | Policy Name |
|---|---|
| `agent_capability_assignments` | `Allow all on agent_capability_assignments` |
| `capability_mcps` | `Allow all on capability_mcps` |
| `capability_skills` | `Allow all on capability_skills` |
| `pentagram_assets` | `Allow all access to pentagram assets` |
| `pentagram_game_saves` | `Allow all access to pentagram saves` |
| `pentagram_image_sequences` | `Public image sequences access` |
| `pentagram_interact_configs` | `Public interact configs access` |
| `project_files` | `Users manage own project files` |
| `projects` | `Users manage own projects` |

#### Solution

```sql
-- Drop the overly permissive policies and replace with user-scoped ones.
-- Example for capability_mcps:
DROP POLICY "Allow all on capability_mcps" ON public.capability_mcps;

-- The existing user-scoped policy should remain. If it also uses (true), fix it:
-- ALTER POLICY "Users can only access their own capability_mcps" 
--   ON public.capability_mcps
--   USING ((select auth.uid()) = user_id)
--   WITH CHECK ((select auth.uid()) = user_id);

-- For pentagram tables (if they are meant to be globally readable):
-- Use a SELECT-only (true) policy and restrict INSERT/UPDATE/DELETE:
DROP POLICY "Allow all access to pentagram assets" ON public.pentagram_assets;
CREATE POLICY "Public read pentagram assets" ON public.pentagram_assets
  FOR SELECT USING (true);
CREATE POLICY "Auth users manage pentagram assets" ON public.pentagram_assets
  FOR ALL USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);
```

### 3c. Functions with Mutable Search Path (5 functions)

| Function |
|---|
| `get_agent_knowledge` |
| `get_agent_context` |
| `get_agent_mcps` |
| `get_agent_skills` |
| `get_agent_tools` |
| `match_knowledge_documents` |

#### Solution

```sql
-- For each function, alter to set an immutable search_path:
ALTER FUNCTION public.get_agent_knowledge SET search_path = public;
ALTER FUNCTION public.get_agent_context SET search_path = public;
ALTER FUNCTION public.get_agent_mcps SET search_path = public;
ALTER FUNCTION public.get_agent_skills SET search_path = public;
ALTER FUNCTION public.get_agent_tools SET search_path = public;
ALTER FUNCTION public.match_knowledge_documents SET search_path = public;
```

### 3d. `vector` Extension in Public Schema

#### Solution

```sql
-- Move the vector extension to the extensions schema:
-- WARNING: This may require re-creating dependent columns. Test on a branch first.
-- CREATE EXTENSION IF NOT EXISTS vector SCHEMA extensions;
-- ALTER EXTENSION vector SET SCHEMA extensions;
```

### 3e. Leaked Password Protection Disabled

Supabase Auth's built-in HaveIBeenPwned check is **disabled**.

#### Solution
Go to **Supabase Dashboard → Authentication → Settings → Security** and enable "Leaked Password Protection".

---

## 4. 🟡 HIGH — Codebase Hygiene

### 4a. 60+ Junk/Diagnostic Files in Dashboard Root

The `dashboard/` directory contains **86 files** at root level, most of which are debug scripts, build logs, and test files that should never exist in a production project:

| Category | Files |
|---|---|
| **Build logs** | `build-log.txt`, `build.log`, `build_check.log`, `build_check2.txt`, `build_deploy_check.txt`, `build_errors.txt`, `build_errors_latest.txt`, `build_errors_new.txt`, `build_output.log`, `build_output2.log`, `build_output3.log`, `build_verify.txt` (x4) |
| **TS error dumps** | `ts-errors.txt`, `ts_errors.txt`, `ts_errors_utf8.txt`, `tsc-errors.txt`, `tsc.log`, `tsc_output.txt`, `typescript-errors.txt`, `raw_errors.txt` |
| **Debug/diagnostic scripts** | `check_notifs.js`, `check_status.js`, `diag_deep.js`, `diagnose_openclaw.js`, `docker_logs.js`, `fetch_health.js`, `find_config.js`, `fix_openclaw.js`, `port_check.js`, `read_openclaw.js`, `restart_docker.js`, `verify_ports.js` |
| **Test scripts** | `test-login.js`, `test-usage-rpc.mjs`, `test_auth_constraints.js`, `test_cron_schema.js`, `test_der_signature.js`, `test_ed25519.js` (x2), `test_magic_client.js`, `test_webcrypto.js`, `tmp_test_sessions.js`, `ws_test.js`, `ws_test_tool.js` |
| **Data dumps** | `chat_lines.txt`, `ws_logs.json`, `ws_logs_tool.json`, `remote_openclaw.json`, `docker_openclaw.json`, `diag_output.txt` (x2), `diag_final.txt`, `diag_verify.txt`, `migrate_err.txt`, `test_output.txt`, `test_hs_debug.log` |
| **Utility scripts** | `download_docker.js`, `download_openclaw.js`, `download_ubuntu.js`, `upload_docker.js`, `upload_openclaw.js`, `create_dev_user.mjs`, `insert_workflow.mjs`, `update_profile.mjs`, `update_workflow.mjs`, `add_auth_to_routes.mjs`, `add_userid_to_queries.mjs` |
| **Other** | `dashboard.db`, `nul` (Windows artifact) |

#### Solution

```bash
# Delete all junk files from the dashboard root.
# Most are already in .gitignore, but they clutter the workspace.
cd dashboard

# Remove build logs
del /q build*.txt build*.log tsc*.txt tsc*.log ts*.txt ts_errors*.txt raw_errors.txt typescript-errors.txt migrate_err.txt

# Remove diagnostic scripts (already in .gitignore, but clean up locally)
del /q check_*.js diag_*.js diag_*.txt diagnose_*.js docker_*.js download_*.js
del /q fetch_health.js find_config.js fix_*.js port_check.js read_openclaw.js
del /q restart_docker.js upload_*.js verify_ports.js

# Remove test scripts
del /q test*.js test*.mjs tmp_*.js ws_test*.js test_*.log test_output.txt

# Remove data dumps
del /q chat_lines.txt ws_logs*.json remote_openclaw.json docker_openclaw.json
del /q diag_output*.txt diag_final.txt diag_verify.txt

# Remove utility/migration scripts
del /q add_auth_to_routes.mjs add_userid_to_queries.mjs create_dev_user.mjs
del /q insert_workflow.mjs update_profile.mjs update_workflow.mjs

# Remove Windows artifacts
del /q nul dashboard.db
```

### 4b. GitHub Repository is Public

The repo `gilanggemar/Ofiere` is marked as **public** (`"githubRepoVisibility": "public"`). This means:
- All source code is visible to anyone
- The `architecture/` and `docs/` directories expose internal design decisions
- Commit messages reveal implementation details

#### Solution
If Ofiere is a commercial product or contains proprietary logic:
```
GitHub → gilanggemar/Ofiere → Settings → Danger Zone → Change visibility → Private
```

---

## 5. 🟡 HIGH — Vercel Deployment Issues

### 5a. Deployment Health

| Metric | Value |
|---|---|
| Total deployments reviewed | 20 |
| Successful (`READY`) | 17 |
| Failed (`ERROR`) | 3 |
| Latest deployment | ✅ `READY` (production) |
| Framework | Next.js |
| Node version | 24.x |
| Bundler | Turbopack |

The 3 failed deployments were all TypeScript build errors that were fixed in subsequent commits. The current production deployment is healthy.

### 5b. No Custom Domain

The app is running on `ofiere.vercel.app`. For a production release, you need a custom domain.

#### Solution
1. Purchase a domain (e.g., `nerv-os.app` or `nerv.systems`)
2. Vercel Dashboard → nerv → Settings → Domains → Add your domain
3. Configure DNS as instructed by Vercel

### 5c. Missing Deployment Protection

The project has `"live": false`, meaning **Deployment Protection is not enabled**.

#### Solution
Enable Deployment Protection in Vercel Dashboard → nerv → Settings → Deployment Protection.

---

## 6. 🟡 HIGH — Database Performance Issues

### 6a. RLS Policies Re-evaluating `auth.uid()` Per Row (35+ tables)

Nearly every RLS policy uses `auth.uid()` directly instead of `(select auth.uid())`. This causes the function to be **re-evaluated for every row** in the query, degrading performance at scale.

**Affected tables (all):** `agents`, `hero_images`, `agent_provider_config`, `agent_xp`, `tasks`, `task_logs`, `summits`, `providers`, `provider_models`, `telemetry_logs`, `audit_logs`, `conversations`, `conversation_messages`, `knowledge_fragments`, `knowledge_documents`, `workflows`, `workflow_runs`, `workflow_templates`, `notifications`, `alert_rules`, `scheduled_tasks`, `scheduler_events`, `webhook_configs`, `mcp_servers`, `platform_bridges`, `api_keys`, `war_room_sessions`, `war_room_events`, `prompt_chunks`, `connection_secrets`, `connection_profiles`, `xp_events`, `daily_missions`, `achievements`, `unlocked_achievements`, `operations_streak`, `capability_mcps`, `capability_skills`, `agent_capability_assignments`, `workflow_checkpoints`, `workflow_gate_approvals`, `workflow_step_logs`, `chat_attachments`, `projects`, `custom_models`, `companion_profiles`

#### Solution

```sql
-- For EVERY RLS policy, change:
--   USING (auth.uid() = user_id)
-- To:
--   USING ((select auth.uid()) = user_id)

-- Example for the agents table:
ALTER POLICY "Users can only access their own agents"
ON public.agents
USING ((select auth.uid()) = user_id);
```

This is a single-character change per policy but applies to **45+ policies**. Run a batch migration.

### 6b. Unindexed Foreign Keys (9 tables)

| Table | Foreign Key |
|---|---|
| `chat_attachments` | `conversation_id` |
| `conversations` | `project_id` |
| `custom_models` | `user_id` |
| `daily_missions` | `agent_id` |
| `scheduled_tasks` | `agent_id` |
| `unlocked_achievements` | `achievement_id`, `agent_id` |
| `war_room_events` | `agent_id` |
| `webhook_configs` | `agent_id` |

#### Solution

```sql
CREATE INDEX IF NOT EXISTS idx_chat_attachments_conversation_id ON public.chat_attachments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON public.conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_custom_models_user_id ON public.custom_models(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_missions_agent_id ON public.daily_missions(agent_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_agent_id ON public.scheduled_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_unlocked_achievements_achievement_id ON public.unlocked_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_unlocked_achievements_agent_id ON public.unlocked_achievements(agent_id);
CREATE INDEX IF NOT EXISTS idx_war_room_events_agent_id ON public.war_room_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_webhook_configs_agent_id ON public.webhook_configs(agent_id);
```

### 6c. Duplicate/Conflicting RLS Policies (3 tables)

The following tables have **two conflicting policies** — one `USING (true)` (allow all) and one user-scoped. The `USING (true)` policy renders the user-scoped one meaningless due to Postgres' OR semantics for permissive policies.

- `agent_capability_assignments`
- `capability_mcps`
- `capability_skills`
- `projects`

#### Solution
Drop the `"Allow all"` policies (see section 3b above).

---

## 7. 🟠 MEDIUM — Application Architecture

### 7a. `reactStrictMode: false`

In `next.config.ts`, React Strict Mode is disabled. This hides potential bugs during development (double-renders, deprecated API usage).

#### Solution
```ts
// next.config.ts
const nextConfig: NextConfig = {
  reactStrictMode: true,  // Enable for production
  // ...
};
```

### 7b. Debug `console.log` in Auth Code

`lib/auth.ts` contains debug logging that will print user IDs to server logs in production:

```ts
console.log("[AUTH DEBUG] getAuthUserId called. Extracted ID:", user?.id);
```

#### Solution
Remove or gate behind `NODE_ENV !== 'production'`:
```ts
if (process.env.NODE_ENV !== 'production') {
  console.log("[AUTH DEBUG] getAuthUserId called. Extracted ID:", user?.id);
}
```

### 7c. `suppressHydrationWarning` in Root Layout

Both `<html>` and `<body>` tags have `suppressHydrationWarning`. This masks real hydration bugs.

#### Solution
Keep it only on `<html>` (needed for `next-themes`), remove from `<body>`.

### 7d. Server Actions Body Size Limit: 50MB

```ts
serverActions: { bodySizeLimit: '50mb' }
```

This is extremely large and could enable abuse (large payload attacks).

#### Solution
Reduce to a reasonable limit (e.g., `4mb`) and use Supabase Storage for large file uploads.

### 7e. No Error Boundary Components

No global error boundary detected. If a component throws, the entire app crashes.

#### Solution
Create `app/error.tsx` and `app/global-error.tsx`:
```tsx
'use client'
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div>
      <h2>Something went wrong</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

---

## 8. 🔵 LOW — Code Quality & Best Practices

### 8a. Package Version `0.1.0`

The app is at version `0.1.0`. Update to `1.0.0` for a production release.

### 8b. Duplicate Store Directories

Both `store/` and `stores/` directories exist. Consolidate into one.

### 8c. `.env.local.example` Should Be Comprehensive

Ensure the example file documents ALL required variables so new developers can onboard.

### 8d. Missing `robots.txt` and `sitemap.xml`

No `robots.txt` or `sitemap.xml` in the `public/` directory.

#### Solution
```
# public/robots.txt
User-agent: *
Disallow: /api/
Allow: /

# If this is a private dashboard, disallow all:
User-agent: *
Disallow: /
```

### 8e. No Rate Limiting on API Routes

API routes under `app/api/` don't appear to implement rate limiting.

#### Solution
Use Vercel's built-in WAF or add middleware-based rate limiting with a library like `@vercel/edge-config` or a Redis-based token bucket.

---

## 9. Checklist Summary

### 🔴 Must Fix Before Launch

- [ ] Set `OFIERE_ENCRYPTION_KEY` in Vercel env vars (and rotate existing encrypted data)
- [ ] Rotate all exposed secrets (OpenClaw token, Agent Zero key/password, Composio key)
- [ ] Add RLS policies to 9 tables that have none
- [ ] Drop overly permissive `USING (true)` policies on 9 tables
- [ ] Fix mutable `search_path` on 6 database functions
- [ ] Enable Leaked Password Protection in Supabase Auth
- [ ] Make GitHub repo private (if commercial)
- [ ] Remove plaintext password from env file (use OAuth or vault)

### 🟡 Should Fix Before Launch

- [ ] Clean up 60+ junk files from dashboard root
- [ ] Fix all RLS policies to use `(select auth.uid())` instead of `auth.uid()`
- [ ] Add indexes to 9 unindexed foreign keys
- [ ] Remove duplicate RLS policies on 3 tables
- [ ] Remove debug `console.log` from auth code
- [ ] Add custom domain to Vercel
- [ ] Enable Vercel Deployment Protection
- [ ] Add `app/error.tsx` and `app/global-error.tsx`
- [ ] Reduce `serverActions.bodySizeLimit` from 50MB to 4MB

### 🟠 Nice to Have

- [ ] Enable `reactStrictMode: true`
- [ ] Remove `suppressHydrationWarning` from `<body>`
- [ ] Consolidate `store/` and `stores/` directories
- [ ] Add `robots.txt` and `sitemap.xml`
- [ ] Update `package.json` version to `1.0.0`
- [ ] Add rate limiting to API routes
- [ ] Move `vector` extension out of public schema
- [ ] Review and clean unused database indexes (20+ flagged)

---

> **Bottom Line:** The app builds and deploys successfully to Vercel, and the core architecture is solid (Next.js + Supabase + proper auth middleware). However, **critical security gaps in the database layer** (missing & overly permissive RLS policies) and **secrets management** must be addressed before any public-facing release. The codebase also needs significant cleanup of debug artifacts before it's presentable as a production project.
