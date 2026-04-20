# Deploying Veyster (web UI only — no CLI)

This guide uses only browser tabs: GitHub, Supabase, and Vercel. You won't
need to run any commands locally.

Expect ~15 minutes total.

---

## 1. Create a Supabase project

1. Go to https://supabase.com and sign in (free).
2. Click **New project**.
   - Name: `veyster`
   - Database password: click **Generate** and save it to a password manager
     (you rarely need it, but you'll want it for future admin tasks).
   - Region: pick the one closest to your users.
   - Plan: Free.
3. Wait ~2 minutes while the project provisions.

---

## 2. Run the database migrations

In your Supabase project, open the **SQL Editor** (left sidebar, the `</>`
icon).

You'll run four SQL files, one at a time. For each file:

1. Open the file in GitHub (links below).
2. Click the **Raw** button in GitHub to see plain text.
3. Copy the whole file.
4. Paste into the Supabase SQL Editor.
5. Click **Run** (bottom right). You should see "Success. No rows returned."
6. Move on to the next file.

Run these in order:

| # | File | What it does |
|---|---|---|
| 1 | `supabase/migrations/0001_init.sql` | Tables, types, indexes, RLS-ready columns |
| 2 | `supabase/migrations/0002_rls.sql`  | Row-level security (who can read/write what) |
| 3 | `supabase/migrations/0003_ethnicity_seed.sql` | US Census + international race/ethnicity options |
| 4 | `supabase/migrations/0004_minimal_geo_seed.sql` | ~55 countries, US states, top 80 US cities |

> **Don't want to deal with the CLI for full GeoNames?** You're done after
> step 4 — you have enough country/state/city data for US-focused testing.
> You can run the full 26,000-city import later.

### If the raw files seem to fail

Always pull the raw file from the **`claude/survey-pwa-swipe-XBOr0`**
branch (not `main`), e.g.:

```
https://raw.githubusercontent.com/kcheng850825/veyster/claude/survey-pwa-swipe-XBOr0/supabase/migrations/0001_init.sql
```

If you've run into errors on a previous attempt, the partial schema may
block a re-run. Clear state first by pasting this into the SQL Editor:

```sql
drop schema public cascade;
create schema public;
grant all on schema public to postgres, anon, authenticated, service_role;
```

Then run 0001 through 0004 fresh. All four are idempotent — safe to
re-run anytime.

### Why there's no plpgsql in these files

Supabase's SQL Editor has a parser quirk that mangles `SELECT … INTO
variable` inside plpgsql function bodies, regardless of dollar-quote
style. To keep paste-and-run reliable, all three trigger jobs
(auto-create profile, bump `updated_at`, cap questions at 10) are
implemented in TypeScript in the app instead.

---

## 3. Collect your Supabase keys

Still in Supabase, click **Project Settings** (gear icon, bottom left) →
**API**.

Copy these three values to a scratch note — you'll paste them into Vercel
in step 6.

| Label in Supabase | What you want | Used for |
|---|---|---|
| **Project URL** | `https://xxxxx.supabase.co` | `NEXT_PUBLIC_SUPABASE_URL` |
| **anon / public** | the first long token starting with `eyJ…` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **service_role / secret** | the second `eyJ…` token (click to reveal) | `SUPABASE_SERVICE_ROLE_KEY` (optional, only for the GeoNames CLI; skip if you're not running it) |

> The `service_role` key is a secret. Don't paste it into any public place.

---

## 4. Configure email sign-in (6-digit code, not magic link)

Supabase's defaults here will trip you up. Follow exactly:

### 4a. Enable the Email provider

- **Authentication → Sign In / Providers** (left sidebar)
- Click **Email** to expand that row
- At the top of the Email pane, make sure **Enable Email Provider** is **ON**
- In the same pane, set **Confirm email** to **OFF** — otherwise new
  signups get an extra "please click this link" email before they can
  even request a sign-in code
- Set **Email OTP Length** to **`6`** (default can be 8 depending on
  project vintage)
- Set **Email OTP Expiration** to `600` (10 min) or leave at 3600 (1 hr)
- Click **Save**

### 4b. Rewrite the email template so it shows the code

By default, Supabase sends a clickable magic link instead of a code.
Change the template so it surfaces `{{ .Token }}` prominently.

- **Authentication → Emails** (it's *Emails*, not *Email Templates* —
  Supabase renamed it)
- Select **Magic Link** from the template list
- **Subject**: `Your Veyster sign-in code`
- **Body** (paste the whole thing, replacing what's there):

  ```html
  <h2>Your Veyster sign-in code</h2>
  <p>Enter this 6-digit code to sign in:</p>
  <p style="font-size:32px;font-weight:bold;letter-spacing:8px;font-family:monospace;">{{ .Token }}</p>
  <p style="color:#666;font-size:13px;">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
  ```

- Click **Save changes**

> **How the code is generated:** when our app calls `signInWithOtp()`,
> Supabase's auth server generates a cryptographically random 6-digit
> number, hashes it into `auth.one_time_tokens`, and emails the plaintext
> via the template. We never see or store the code — we just hand the
> user's typed-in number back to Supabase for verification.

### 4c. URL Configuration (come back to this in step 7)

After Vercel gives you a URL, you'll set **Site URL** and
**Redirect URLs** under **Authentication → URL Configuration**.

### 4d. Users stuck as "unconfirmed"

If you signed up any test accounts *before* toggling "Confirm email"
off, those accounts are stuck in an unconfirmed state and can't sign in
even after the toggle flip. Fix: **Authentication → Users**, find the
row, either delete it (and re-sign-up fresh) or click the row and
manually mark as confirmed.

---

## 5. Deploy to Vercel

1. Go to https://vercel.com and sign in with GitHub.
2. Click **Add New → Project**.
3. Find the `kcheng850825/veyster` repo in the list → click **Import**.
4. On the "Configure Project" screen:
   - **Framework preset**: Next.js (auto-detected).
   - **Branch to deploy**: change from `main` to **`claude/survey-pwa-swipe-XBOr0`**.
     (Click the branch dropdown next to the repo name.)
   - **Root directory**: leave as `./`.
   - **Build command / Output directory**: leave defaults.

---

## 6. Add environment variables on Vercel

On the same Vercel import screen, expand **Environment Variables** and add:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | (paste the Project URL from step 3) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (paste the anon key from step 3) |
| `NEXT_PUBLIC_SITE_URL` | leave blank for now — we'll fill it in step 7 |

Leave all three environments (**Production**, **Preview**, **Development**)
checked.

Click **Deploy**. First build takes ~90 seconds.

---

## 7. Wire up the site URL

Vercel will give you a URL like `https://veyster-abc123.vercel.app`.

1. **On Vercel** → **Project → Settings → Environment Variables**:
   - Edit `NEXT_PUBLIC_SITE_URL` and paste your Vercel URL
     (without trailing slash, e.g. `https://veyster-abc123.vercel.app`).
   - Click **Save**.
   - Go to **Deployments**, find the latest deployment, click the **⋯**
     menu, and choose **Redeploy** (so the new env var takes effect).

2. **On Supabase** → **Authentication → URL Configuration**:
   - **Site URL**: paste your Vercel URL.
   - **Redirect URLs** (Add URL): add both:
     - `https://veyster-abc123.vercel.app/**`
     - `http://localhost:3000/**` (for local dev later)
   - Click **Save**.

---

## 8. Smoke test

1. Open your Vercel URL. You should see the Veyster landing page.
2. Click **Get started** → enter your email → you'll get a 6-digit code.
3. Enter the code → you land on onboarding.
4. Fill in your demographics → click **Finish setup** → you land on the feed.
5. Click **My surveys → New survey**. Give it a title. Create.
6. Add 2–3 questions. Set branching on one of them (`If Yes → End`).
   Click **Publish**.
7. Click **Share**. Copy the URL.
8. Open the URL in a different browser (or incognito). Sign up with a
   different email. Swipe through the survey.
9. Back in the first browser, click **Results** on your survey. You'll see
   yes/no counts.

If any of this fails, check the Vercel deployment logs (Vercel → your
project → Deployments → latest → **Runtime Logs**).

---

## 9. (Optional) Full GeoNames import for worldwide cities

You only need this if you want cities outside the top 80 US cities. This
step needs your laptop for 5 minutes.

1. Install Node.js 20+ from https://nodejs.org if you don't already have it.
2. Download the repo as a zip: GitHub → repo → **Code → Download ZIP** — or
   clone with GitHub Desktop (https://desktop.github.com).
3. Open a terminal in the unzipped folder and run:

   ```bash
   npm install
   npm i -D adm-zip
   ```

4. Create a file called `.env.local` in that folder with:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

5. Run:

   ```bash
   npm run seed:geo
   ```

   Takes ~2 minutes, imports ~26,000 cities.

---

## Common issues

**"MIDDLEWARE_INVOCATION_FAILED" on the home page**
The env vars aren't set on Vercel yet, or the latest env-var edit hasn't
been deployed. Redeploy the latest commit (Vercel → Deployments → **⋯** →
Redeploy).

**"Invalid login credentials" on the OTP step**
Double-check that **Email** provider is enabled in Supabase → Authentication
→ Providers.

**Emails not arriving**
Supabase's free tier uses a low-volume email relay. Check spam. For
production, set up custom SMTP in Supabase → Authentication → SMTP Settings
(Resend, Postmark, Mailgun — all have free tiers).

**"Permission denied for table X" in the app**
You skipped the RLS migration (`0002_rls.sql`) or ran it before `0001_init.sql`.
Run them in order.

**Can't find my city in the dropdown**
You only ran the minimal seed. Either run the full GeoNames import
(section 9) or pick a nearby city; it's stored as a reference number, not
the label.
