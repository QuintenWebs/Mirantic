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

### 4. Resend (invite emails)

Create a Resend account, verify **mirantic.com** (add the DNS records it gives
you), then create an API key → `RESEND_API_KEY`. Set `INVITE_FROM` to an address
on the verified domain, e.g. `Mirantic <invites@mirantic.com>`. Without this,
clients are still created but the invite link has to be sent by hand.

### 5. Vercel Blob (image uploads)

In the Vercel dashboard, create a Blob store and copy its token →
`BLOB_READ_WRITE_TOKEN`. If you skip this, image fields fall back to pasting a
URL (no file upload).

### 6. Deploy

Push to GitHub, import into Vercel, set all env vars from `.env.example` in the
Vercel project settings, and deploy. Point `app.mirantic.com` at it.

### 7. Make yourself the admin

Sign in once (this provisions your user row), then in Neon SQL:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@mirantic.com';
```

Reload — you now see the admin Dashboard / Clients / Sites nav.

## Access model

Sign-in is **invite only**. Authenticating with Auth0 is not by itself enough:
a user row must already exist, created by an admin. Anyone else who reaches
Auth0 gets a 403 and a "not invited" message rather than becoming a user.
Public sign-up is switched off at the Auth0 connection too (see below), so the
login page offers no "Sign up" link.

The admin is set once by hand in SQL (see step 6 above). Admins additionally
have a **role switcher** in the header: *Admin* shows the full admin panel,
*Client* narrows the app to the sites that admin is assigned to, reproducing
what a client sees. It is presentation only — every endpoint still authorises
from the real role in the database.

## Adding a client

Admin → **Clients → Add client**. This creates their Auth0 login and emails
them an invite (Resend). The invite link is also shown, so it can be sent by
hand if the email fails or the address is wrong. The mail icon on a client row
re-sends the invite with a fresh link. Then open the client and assign sites
with edit / publish permissions.

## Auth0 configuration

Sign-up is disabled and the login page is branded through
[`scripts/auth0-setup.mjs`](./scripts/auth0-setup.mjs) rather than by clicking
through the dashboard, so the settings are versioned and repeatable:

```bash
node scripts/auth0-setup.mjs --dry-run   # show what it would touch
node scripts/auth0-setup.mjs
```

It reads the M2M credentials from `.env.local`. Beyond the scopes in step 2
that app also needs `read:connections`, `update:connections`, `read:branding`,
`update:branding`, `read:branding_themes`, `create:branding_themes`,
`update:branding_themes`, `read:prompts` and `update:prompts`. Each step is
reported separately, so a missing scope fails only that step. Edit the `BRAND`
block at the top of the script to change the look.

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
