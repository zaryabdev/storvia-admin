# storvia-admin

The merchant dashboard and the only backend of Storvia: a Next.js app that hosts the authenticated dashboard (catalog, orders, settings), the public Storefront API, and the privileged Super Admin API, backed by Prisma and PostgreSQL.

Stack: Next.js 13.4 (App Router), React 18, TypeScript, Tailwind, shadcn/ui, Prisma 4 + PostgreSQL, Clerk, Cloudinary, Resend.

## Setup

```bash
npm install                 # also runs prisma generate
cp .env.example .env        # then fill in the values
npm run dev                 # http://localhost:4000
```

Set `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to a PostgreSQL database whose schema is built from `prisma/migrations` (`npx prisma migrate deploy`).

## More

- `AGENTS.md`: working rules for this repo (`CLAUDE.md` imports it).
- `../storvia-ai-context`: project state, API contracts, decisions and the backlog.
