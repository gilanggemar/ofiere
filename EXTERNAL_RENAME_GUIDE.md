# Ofiere — External Services Manual Rename Guide

> After completing the internal codebase rename from Ofiere → Ofiere, the following external
> services and configurations still reference the old name. This document explains **what** needs
> to change, **why**, and **what happens if you don't**.

---

## 1. GitHub Repository

| Item | Current | Target |
|---|---|---|
| Repo name | `Ofiere` (under `gilanggemar`) | `Ofiere` |
| Default description | References Ofiere | Update to Ofiere |

**Why rename?**
- All Vercel deployments are linked to this repo name
- The `ofiere_mcp` file still exists alongside the new `ofiere_mcp` — delete `ofiere_mcp` after verification
- The local folder `Ofiere` should be renamed to `Ofiere` to match

**What happens if you don't?**
- Functionally nothing breaks — Git doesn't care about repo names at the protocol level
- But every Vercel deployment, CI/CD pipeline, and collaborator URL will still show `Ofiere`
- The `tools/upload_vercel_env.js` hardcoded path will need updating after folder rename

**How to rename:**
1. Go to GitHub → Settings → Repository name → Change to `Ofiere`
2. Update local remote: `git remote set-url origin https://github.com/gilanggemar/Ofiere.git`
3. Rename local folder from `Ofiere` to `Ofiere`

---

## 2. Vercel Project

| Item | Current | Target |
|---|---|---|
| Project name | `nerv` | `hecate` |
| Production domain | `ofiere.vercel.app` | `hecate.vercel.app` (or custom domain) |
| Environment variables | `OFIERE_ENCRYPTION_KEY` | `OFIERE_ENCRYPTION_KEY` |

**Why rename?**
- The codebase now reads `OFIERE_ENCRYPTION_KEY` (not `OFIERE_ENCRYPTION_KEY`)
- If you don't add/rename the env var on Vercel, the app will fall back to the **insecure default key**
- Preview/production URLs will still say `nerv`

**What happens if you don't?**
- ⚠️ **CRITICAL**: If `OFIERE_ENCRYPTION_KEY` is set on Vercel but the code now reads `OFIERE_ENCRYPTION_KEY`, the app will use the fallback key and **all encrypted data will be undecryptable**
- You MUST add `OFIERE_ENCRYPTION_KEY` with the **same value** as the old `OFIERE_ENCRYPTION_KEY`
- After confirming the new var works, you can remove the old one

**How to rename:**
1. Go to Vercel → Project Settings → Environment Variables
2. Add `OFIERE_ENCRYPTION_KEY` with the same value as `OFIERE_ENCRYPTION_KEY`
3. Optionally rename the project from `nerv` to `hecate` in General Settings
4. Redeploy to pick up the new env var

---

## 3. Supabase

### 3a. Project Name

| Item | Current | Target |
|---|---|---|
| Project display name | May reference Ofiere | Update to Ofiere |

**Why rename?**
- Purely cosmetic — Supabase uses the project ID internally, not the display name
- Helps with organization in the Supabase dashboard

**What happens if you don't?**
- Nothing breaks. It's just a label.

### 3b. Storage Bucket

| Item | Current | Target |
|---|---|---|
| Bucket name | `ofiere-images` | `ofiere-images` |

**Why rename?**
- The codebase (`supabaseStorage.ts` and `api/storage/sync/route.ts`) now references `ofiere-images`
- If the Supabase bucket is still named `ofiere-images`, **all image uploads/downloads will fail (404)**

**What happens if you don't?**
- ❌ **BREAKING**: Image uploads and agent avatar syncing will fail
- You have two options:
  1. **Rename the bucket** on Supabase to `ofiere-images`
  2. **Or** create a new `ofiere-images` bucket and migrate existing files

**How to rename:**
1. Go to Supabase → Storage → Find `ofiere-images` bucket
2. Supabase doesn't support direct bucket rename — you need to:
   - Create a new `ofiere-images` bucket with the same policies
   - Copy all files from `ofiere-images` to `ofiere-images`
   - Delete the old bucket (optional)
3. Alternatively, update the RLS policies on the new bucket to match

### 3c. Environment Variable in MCP Server

| Item | Current | Target |
|---|---|---|
| MCP env var | `OFIERE_USER_ID` | `OFIERE_USER_ID` |

**Why rename?**
- The `dashboard-mcp/src/config.ts` now reads `OFIERE_USER_ID`
- This variable scopes all Supabase queries to the correct user

**What happens if you don't?**
- ❌ **BREAKING**: The MCP server will crash on startup with `"OFIERE_USER_ID environment variable is required"`

**How to fix:**
1. In your MCP server environment (e.g., `.env` file or shell config), rename:
   ```
   OFIERE_USER_ID=your-uuid → OFIERE_USER_ID=your-uuid
   ```

---

## 4. OpenClaw / Agent Zero Gateway

| Item | Current | Target |
|---|---|---|
| Client ID in gateway | `ofiere-dashboard` | `ofiere-dashboard` |
| User agent string | `ofiere-dashboard/0.1.0` | `ofiere-dashboard/0.1.0` |

**Why rename?**
- Already changed in code (`openclawGateway.ts`)
- The gateway server may have ACLs or logging keyed to the old client ID

**What happens if you don't?**
- If the gateway has hardcoded ACLs checking for `ofiere-dashboard`, connections may be rejected
- If using open registration, nothing breaks — the new client ID will register automatically

**How to fix:**
1. Update any gateway-side ACLs/allowlists from `ofiere-dashboard` to `ofiere-dashboard`
2. Update any monitoring/logging filters accordingly

---

## 5. API Keys & Webhook Secrets

| Item | Current | Target |
|---|---|---|
| Webhook env var | `OFIERE_WEBHOOK_SECRET` | `OFIERE_WEBHOOK_SECRET` |
| Encryption key | `OFIERE_ENCRYPTION_KEY` | `OFIERE_ENCRYPTION_KEY` |

**Why rename?**
- Code now reads `OFIERE_WEBHOOK_SECRET` as a fallback for `OPENCLAW_WEBHOOK_SECRET`
- Code now reads `OFIERE_ENCRYPTION_KEY` for encryption

**What happens if you don't?**
- If only `OFIERE_WEBHOOK_SECRET` is set in your env, webhook validation will fail (unless `OPENCLAW_WEBHOOK_SECRET` is also set — that one takes priority)
- Encryption will fall back to the insecure default key

**How to fix:**
1. Add `OFIERE_WEBHOOK_SECRET` and `OFIERE_ENCRYPTION_KEY` to your environment
2. Use the **same values** as the old `NERV_*` equivalents
3. Remove old vars after confirming everything works

---

## 6. Local Files to Clean Up

| File | Action |
|---|---|
| `ofiere_mcp` (root) | Delete after verifying `ofiere_mcp` works |
| `OfiereSkeleton.tsx` | Delete after verifying `OfiereSkeleton.tsx` works (currently unused by imports) |
| `RENAME_IMPACT_ANALYSIS.md` | Archive or delete — migration is complete |

---

## 7. Priority Order

> [!IMPORTANT]
> Complete these in order to avoid breaking the production app:

1. **Vercel env var** — Add `OFIERE_ENCRYPTION_KEY` with same value as old key ⚡
2. **Supabase bucket** — Create `ofiere-images` and migrate files 🗄️
3. **MCP server env** — Rename `OFIERE_USER_ID` → `OFIERE_USER_ID` 🔧
4. **Vercel redeploy** — After env vars are set 🚀
5. **GitHub repo rename** — Cosmetic, lowest risk 📝
6. **Gateway ACLs** — If applicable 🔒
7. **Clean up old files** — `ofiere_mcp`, `OfiereSkeleton.tsx` 🧹

---

## Summary

| Service | Risk if not renamed | Priority |
|---|---|---|
| Vercel env vars | ❌ **Data loss** (encryption fallback) | **CRITICAL** |
| Supabase bucket | ❌ **App broken** (image 404s) | **HIGH** |
| MCP server env | ❌ **Server crash** | **HIGH** |
| Gateway ACLs | ⚠️ Connection rejected (if ACLs exist) | MEDIUM |
| Webhook secret | ⚠️ Webhook validation fails | MEDIUM |
| GitHub repo name | ✅ Cosmetic only | LOW |
| Supabase project name | ✅ Cosmetic only | LOW |
| Vercel project name | ✅ Cosmetic only | LOW |
