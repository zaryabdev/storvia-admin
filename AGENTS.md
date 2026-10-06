# AGENTS.md: storvia-admin

## What this repo is

The Storvia merchant dashboard, the system of record (Prisma + PostgreSQL) and the **only REST API**. It serves the public Storefront routes, the merchant routes and the privileged Super Admin routes. The Storefront and Super Admin are frontends that call it.

## Project context lives in `../storvia-ai-context`

Read, in order:
1. `PROJECT_BRIEF.md`
2. `projects/admin/CONTEXT.md` (current state and all shared API contracts)
3. `RELEASES.md` (current iteration and Backlog)
4. `DECISIONS.md`, before touching billing, API contracts, auth, tenancy or money.

Source code wins over docs. If they disagree, follow the source and fix the doc.

## Commands

- `npm run dev`: dev server on port 4000.
- `npm run build`, `npm run lint`, `npx tsc --noEmit` (no test framework: these are the checks).
- `npx prisma validate`, `npx prisma generate` (also runs on `npm install`).
- `npm run seed:demo`: demo-data reset for one Store; dev only (see `scripts/seed-demo-data.mjs` for its env guards).

## Hard rules

Working:
- Do not commit, push or switch branches unless asked.
- No new dependencies without asking. Keep changes scoped to the request.
- Never write real env values into files.

Database:
- This is the only repo with database access.
- Create migrations with `npx prisma migrate dev --create-only`, then ask the owner before applying. Never run `migrate reset`. Never run `migrate deploy`, `migrate resolve` or `db push` against dev or production yourself.
- Disposable DB scripts use `ZZVERIFY` names and clean up after themselves. If the database is unreachable on the first attempt, skip the script and list manual checks instead.

Architecture:
- Every merchant query and mutation is Store-scoped: ownership check first, then `lib/store-scope.ts` for target rows and foreign ids. A row in another Store behaves like a missing one (404).
- Merchant API responses: 401 unauthenticated, 403 non-owner, 404 not in this Store, 409 still in use (`lib/delete-guards.ts`).
- Money is Decimal (`PreciseDecimal` from `lib/decimal.ts`), never floats.
- The sales rule is implemented once, in `lib/store-sales.ts`; the dashboard and Super Admin both use it.
- Category icons come only from `lib/category-icons.ts` (and `lib/custom-icons.tsx`), identical in the Storefront.
- Public Storefront routes are a cross-repo contract (`projects/admin/CONTEXT.md`); do not change their shape casually.

## Gotchas

- Next.js 13.4.5 (App Router). `lucide-react` is pinned at exactly 0.577.0 until Next.js is upgraded.
- `prisma/schema.prisma` has a `directUrl` (`DATABASE_URL_UNPOOLED`) that comes from `.env`. When targeting another database, override **both** `DATABASE_URL` and `DATABASE_URL_UNPOOLED`, or Prisma silently uses the `.env` one.
- The `next/font` Google Inter fetch can fail `npm run build` in restricted environments; say so rather than treating it as a code error.
- Clerk, Cloudinary and Resend need real keys for the related features; see `.env.example`.

## Updating docs

After a change, update `../storvia-ai-context` (the affected `CONTEXT.md`, `RELEASES.md`, `QA.md`), not this file, unless the working rules themselves changed.
