# Mirantic CMS

A content editor for client websites. Clients log in, click anything on their
site, edit it, and publish. Publishing commits `content.json` to the site's
GitHub repo and triggers a redeploy.

Deployed at **app.mirantic.com** (Vercel).

## Stack

- React + Vite + TypeScript, shadcn/ui, Tailwind
- Auth0 (authentication)
- Neon (serverless Postgres) + Drizzle ORM
- Vercel Serverless Functions (`/api`)
- GitHub API via Octokit (commits `content.json`)
- Vercel Blob (image uploads)

## How it works

The editor loads the client's live site in an iframe. A small script shipped
with each site — [`client-template/cms-bridge.js`](./client-template/cms-bridge.js) —
communicates with the editor over `postMessage` to highlight editable elements,
report clicks, and preview pending edits live. Edits are stored as **pending
changes** in the database; **publish** applies them all to `content.json`,
commits to GitHub, and triggers a deploy. See
[`client-template/README.md`](./client-template/README.md) for wiring a site.

The CMS only ever reads and writes `content.json` — never anything else in a
client repo.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the values (see Setup below)

# Terminal 1 — serverless functions + frontend together:
npx vercel dev               # serves /api and the app on http://localhost:3000

# OR run the Vite frontend with HMR and proxy /api to `vercel dev`:
#   VITE_API_PROXY=http://localhost:3000 npm run dev   (in a second terminal)
```

`vercel dev` is the simplest path locally because the API routes are Vercel
functions. Pull env vars with `vercel env pull .env.local` once linked.

## Setup

### 1. Neon

Create a Neon project, copy the connection string into `DATABASE_URL`, then push
the schema:

```bash
npm run db:push     # creates tables from api/_lib/schema.ts
```

### 2. Auth0

- Create a **Single Page Application**. Set:
  - Allowed Callback URLs: `https://app.mirantic.com, http://localhost:3000`
  - Allowed Logout URLs: same
  - Allowed Web Origins: same
  - → `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_DOMAIN`
- Create an **API** (Applications → APIs). Its Identifier becomes the audience
  → `VITE_AUTH0_AUDIENCE` and `AUTH0_AUDIENCE` (e.g. `https://app.mirantic.com/api`).
- Create a **Machine-to-Machine** app authorized for the **Auth0 Management
  API** with scopes `create:users read:users update:users create:user_tickets`
  → `AUTH0_M2M_CLIENT_ID`, `AUTH0_M2M_CLIENT_SECRET`.
- Ensure the SPA requests scopes `openid profile email` (already configured).

### 3. GitHub

Create a fine-grained Personal Access Token with **Contents: Read and write**
on the client site repos → `GITHUB_TOKEN`.

### 4. Vercel Blob (image uploads)

In the Vercel dashboard, create a Blob store and copy its token →
`BLOB_READ_WRITE_TOKEN`. If you skip this, image fields fall back to pasting a
URL (no file upload).

### 5. Deploy

Push to GitHub, import into Vercel, set all env vars from `.env.example` in the
Vercel project settings, and deploy. Point `app.mirantic.com` at it.

### 6. Make yourself the admin

Sign in once (this provisions your user row), then in Neon SQL:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@mirantic.com';
```

Reload — you now see the admin Dashboard / Clients / Sites nav.

## Adding a client

Admin → **Clients → Add client**. This creates their Auth0 login and returns an
invite link (copy and send it). Then open the client and assign sites with edit
/ publish permissions.

## Project layout

```
api/                 Vercel serverless functions
  _lib/              shared backend code (auth, db, github, content)
  admin/             admin-only endpoints
src/
  components/ui/     shadcn/ui primitives
  components/editor/ the iframe editor sidebar pieces
  lib/               api client, auth, bridge protocol, helpers
  pages/             routes (Login, SiteSelector, Editor, admin/*)
client-template/     what goes INTO each client site (bridge + docs)
```
