# Preview deployment guide

Deploy VinAthletics to a protected **Vercel Preview** environment with a separate
hosted PostgreSQL database. This guide uses PowerShell on Windows and the current
repository setup. It prepares a team preview; public launch comes later.

## 1. Understand what we are deploying

Deploy the repository root. Next.js serves both the interface and `/api` routes,
including authentication and membership plans. The `backend/` directory contains
the shared Prisma schema, but its Express scaffold does not need a separate
deployment. This follows [the API ownership decision](adr/0001-nextjs-api-ownership.md).

The preview currently combines two kinds of sample data:

- Hardcoded members, schedules, and other interface examples. Many operations
  still change only in-memory state and can reset on reload.
- Database-backed Accounts, sessions, and membership plans. The plan API reads
  records already stored in PostgreSQL.

Sign-in requires a database-backed Account created through email registration or
Google. A deployed preview does not make unfinished workflows functional.

## 2. Prepare the project and preview database

Install Node.js **24** and sign up for Vercel and a hosted PostgreSQL service.
Neon is one option; its [connection guide](https://neon.com/docs/get-started/connect-neon)
explains how to obtain a PostgreSQL connection string.

Create a new, empty database/project named something like `vinathletics-preview`.
Keep this separate from both your local development database and the future
production database. Use fictional gym records, not actual member records.

For this initial, low-traffic preview, obtain a **direct PostgreSQL connection
string** with the provider's required TLS settings. The current Prisma schema
uses one `DATABASE_URL` for both migrations and runtime. Connection pooling can
be configured separately as deployment needs grow; do not substitute a
transaction-pooler URL into migration commands without checking compatibility.

Open PowerShell in the repository root and run:

```powershell
node --version
npm.cmd ci
```

Create a local file named `.env.preview.local` containing only the preview
database connection string. Use the provider's exact URL, including TLS options:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
```

This filename is covered by the existing `.env.*` Git ignore rule. Keep it local.
Unlike `.env.local`, it is not automatically loaded by normal Next.js development.
If your terminal already exports `DATABASE_URL`, open a fresh terminal without
that override: exported variables take precedence over `--env-file`.

Apply the committed migrations explicitly to this database:

```powershell
node --env-file=.env.preview.local scripts/prisma.mjs migrate deploy
node --env-file=.env.preview.local scripts/prisma.mjs migrate status
```

Check that the output identifies your preview database and reports migrations
up to date. These commands create/update its tables; they do not copy local data.
Do not use `migrate dev`, `migrate reset`, or `db push` for hosted deployments.

## 3. Create and link the Vercel project

Run:

```powershell
npx.cmd vercel@latest login
npx.cmd vercel@latest link
```

Choose your intended Vercel account/team. Create a project named
`vinathletics` if one does not exist, or select the existing project. Choose the
current directory (`./`) as the application root. This links the folder without
deploying it. See [Vercel's link command](https://vercel.com/docs/cli/link).

If offered a download of environment settings, skip it for now so your local
development settings are preserved. Check that the generated `.vercel/` directory
is ignored by Git; add `.vercel/` to `.gitignore` if the CLI has not done so.

Create a root `.vercelignore` file (or append to the existing one) with these
patterns so local environment files are excluded from CLI uploads:

```gitignore
.env*
**/.env*
```

Vercel will receive its configuration from the dashboard variables in step 4.

In the project's Vercel settings, use:

| Setting | Value |
| --- | --- |
| Framework preset | Next.js |
| Root directory | Repository root, not `backend/` |
| Node.js version | `24.x` |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | Leave the Next.js default |

Vercel supports [Node.js 24](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
The existing install and build scripts generate Prisma's client. The build does
**not** apply database migrations; step 2 handles that separately.

## 4. Protect the preview and set its variables

In **Settings → Deployment Protection**, enable **Vercel Authentication** with
a scope covering preview deployments, such as Standard Protection. Testers must
have access through Vercel's supported team/sharing options. This protection is
separate from the gym app's login. See [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication).

Choose a unique preview hostname, for example
`vinathletics-preview-YOURTEAM.vercel.app`. Replace `YOURTEAM` with your own unique
suffix everywhere below. We will assign this address after the first build, so
the app can use a stable URL for login and origin checks.

Under **Settings → Environment Variables**, add these values with **Preview only**
selected:

| Variable | Preview value |
| --- | --- |
| `DATABASE_URL` | The same preview database URL used in step 2 |
| `NEXTAUTH_URL` | `https://vinathletics-preview-YOURTEAM.vercel.app` |
| `NEXTAUTH_SECRET` | A newly generated random secret |
| `NEXT_PUBLIC_BOOKING_TIME_ZONE` | `Asia/Manila` |
| `NEXT_PUBLIC_GCASH_TEST_FEE_PHP` | `0` |
| `ACTIVE_PLAN_LIMIT` | `4` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Valid mail settings for email registration and verification |

Generate each secret locally by running this command separately:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Paste the results into the corresponding Vercel fields. Do not commit them.
Leave `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` unset until step 7.
Do not manually set `VERCEL_ENV` or `NODE_ENV`; Vercel supplies them.
The Express-only `PORT` and `FRONTEND_URL` variables are unnecessary here.

Environment changes apply to new deployments, so deploy again after changing
them. See [Vercel environment variables](https://vercel.com/docs/environment-variables).

## 5. Create the first deployment, then deploy to Preview

**New-project exception:** Vercel treats a project's very first deployment as
Production, even with `--target=preview`. It uses Production variables. A failed
or canceled deployment still counts as that first deployment. See
[Vercel's first-deployment rules](https://vercel.com/docs/deployments/environments#first-deployment).

For a new project, leave Production variables empty. Run the command below once;
this app is expected to fail its initial Production build because `DATABASE_URL`
is missing. Keep that failed deployment in the dashboard, then run the same
command again to create the actual Preview with the Preview variables. Do not
copy preview secrets into Production to fix the initial build. If the project
already has a deployment record, skip this initial attempt.

Run from the repository root:

```powershell
npx.cmd vercel@latest deploy --target=preview
```

This uploads the current local project, including eligible uncommitted changes.
Review `git status --short` first so you know which version you are deploying.
Use the explicit Preview target; do not use `--prod` or a temporary deployment.
See [Vercel deployment targets](https://vercel.com/docs/cli/deploy#target).

For the Preview attempt, wait for a successful build, then copy the generated deployment hostname from
the output. Assign the stable address chosen in step 4:

```powershell
npx.cmd vercel@latest alias set GENERATED-DEPLOYMENT.vercel.app vinathletics-preview-YOURTEAM.vercel.app
```

Replace both example hostnames. An alias points an address at a deployment; it
does not change that deployment into Production. If the address is already
taken, choose another unique one, update `NEXTAUTH_URL`, deploy again, and assign
the new address. See [Vercel aliases](https://vercel.com/docs/cli/alias).

Confirm that the deployment dashboard shows **Preview**. Open the stable address
in a private browser window and confirm Vercel blocks access until authorized.
Share this stable address with reviewers after verifying protection. Use it for
app testing: other deployment URLs will not match the configured auth origin.

## 6. Check that the preview works

After passing Vercel's access check:

- Register a designated test member through the configured SMTP verification flow,
  or use the configured Google provider. Sign in with that Account.
- Refresh while signed in to check database-session restoration, then verify logout.
- Open `/api/gym-plans` in the same browser. It should return JSON containing
  the stored plan catalog, not a database configuration error.
- Review desktop and mobile layouts. Treat simulated payments as demonstrations.

Keep review records fictional. Testing Google sign-in will store the tester's
actual Google identity in the preview database, so use designated test accounts.

## 7. Optional: test Google sign-in

Create a Google OAuth **Web application** client for preview testing. Configure
the consent screen and add designated test users if the app is in Testing mode.
Register this exact authorized redirect URI, using your chosen hostname:

```text
https://vinathletics-preview-YOURTEAM.vercel.app/api/auth/callback/google
```

Google requires an exact redirect-URI match; see its
[web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server).
Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to Vercel's **Preview** variables.
Deploy again and update the preview alias to the new deployment as in step 5.

A new Google Account receives member authority, not an admin Assigned Role or
a purchased Membership. The current implementation can direct it to `/account`
for required completion steps that are still being developed. That limitation
is separate from whether hosting and OAuth are configured correctly.

## 8. Update the preview during development

For each version you want the team to review:

1. Run the relevant project checks locally. `npm.cmd run typecheck` and
   `npm.cmd test` are the documented checks; the integration suite uses disposable
   PostgreSQL, not the preview database.
2. If committed migrations changed, apply them to the preview database using
   step 2 before deploying code that needs them.
3. Run the Preview deployment command from step 5.
4. Update the stable alias to the new successful deployment.
5. Repeat the login and database smoke checks.

This manual workflow does not require connecting GitHub to Vercel. If you later
enable Git integration, use a non-production branch for preview updates and
check the configured production branch before enabling automatic deployments.
Pushing to that production branch can publish a Production deployment. See
[Vercel environments](https://vercel.com/docs/deployments/environments).

## Common problems

| Symptom | What to check |
| --- | --- |
| First deployment is Production and fails for missing variables | Follow the new-project exception in step 5; keep that record and deploy again to Preview. |
| `DATABASE_URL is required` during build | Variable exists in Preview scope; root directory is correct; deploy again after adding it. |
| `/api/gym-plans` returns an error | Database URL, provider TLS/network settings, and migration status against the same database. |
| Email registration returns `EMAIL_UNAVAILABLE` | Configure a valid SMTP sender and restart or redeploy the app. |
| Google reports `redirect_uri_mismatch` | Exact HTTPS hostname and `/api/auth/callback/google` path match the Google client and `NEXTAUTH_URL`. |
| Login redirects to an old site or API writes report an origin error | Open the stable alias matching `NEXTAUTH_URL`; check the alias points to the latest deployment. |
| A reviewer sees a Vercel login screen | Deployment protection is working; grant them appropriate Vercel access. |
| A simulated change disappears after refresh | That workflow may still use in-memory state; deployment does not add persistence. |
| Generated Prisma client is missing | Build from the root and retain the existing install/build scripts. |

## Later: launch publicly

Keep this preview for future testing. When the essential workflows are complete:

1. Create a separate production database and apply the reviewed migrations.
2. Set **Production-only** database credentials and new auth secrets in Vercel.
3. Configure the public domain, its `NEXTAUTH_URL`, and the production Google OAuth
   callback. Rebuild for Production so the correct variables are used.
4. Verify real sign-in, Account completion, Assigned Roles, persistent workflows,
   and any real payment integration. Establish database backups and recovery.
5. Review the stored plan catalog and replace unfinished sample workflows where required.
6. Deploy to Production and verify its public-domain access settings. Keep
   Preview protected and connected to its own database.

The hosting project can stay the same. Launch requires a production deployment
with production configuration and data.
