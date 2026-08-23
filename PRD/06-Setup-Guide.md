# Setup Guide — Accounts, Keys & Environment

Do this **before** handing the PRD to Claude Code — Claude Code can scaffold the project, but it can't create accounts or get you API keys on external services (those require you to sign up and click through consent screens yourself).

Work through this top to bottom. Total time: roughly 45-75 minutes. Keep a scratch notes file open — you'll be pasting values from these dashboards into a single `.env.local` file at the end.

---

## 1. GitHub (repo hosting)

1. Go to https://github.com, sign in (or create an account if you don't have one)
2. Click **New repository**
3. Name it `momentum` (or whatever you decide), set to **Private**, don't initialize with a README (you'll push from your local machine)
4. Copy the repo URL shown (e.g., `https://github.com/yourname/momentum.git`) — you'll need it when Claude Code initializes git and pushes

No API key needed here — just the repo existing.

---

## 2. Vercel (hosting + cron jobs)

1. Go to https://vercel.com/signup
2. Sign up using **"Continue with GitHub"** — this links your GitHub account directly, which makes deployment trivial later (Vercel auto-deploys on every push)
3. That's it for now — you'll come back after Claude Code has scaffolded the project to click **"Import Project"** and select your `momentum` repo
4. No API key needed for basic use; Vercel Cron Jobs are configured via a `vercel.json` file in your repo (Claude Code will create this) — no separate account setup required, it's included in the free Hobby tier

---

## 3. Supabase (database, auth, file storage)

1. Go to https://supabase.com, sign up (GitHub sign-in works here too)
2. Click **New Project**
3. Name it `momentum`, set a strong database password (**save this password somewhere** — you won't see it again), pick the region closest to you
4. Wait ~2 minutes for provisioning
5. Once ready, go to **Project Settings → API**
6. Copy these three values into your notes:
   - `Project URL` → this is your `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (click "Reveal") → this is your `SUPABASE_SERVICE_ROLE_KEY` — **never expose this in frontend code, server-side only**
7. Go to **Authentication → Providers**, make sure **Email** provider is enabled (it is by default)
8. Go to **Authentication → Users**, click **Add User** manually, create your one login (your email + a password) — this is the only account this app will ever have
9. Go to **Storage**, create a new bucket called `documents` (for Masters Abroad files, resumes) and another called `media` (for travel photos) — set both to **private** (not public)

---

## 4. Google AI Studio (Gemini API — free tier)

1. Go to https://aistudio.google.com
2. Sign in with any Google account
3. Click **Get API Key** → **Create API Key**
4. Copy the key → this is your `GEMINI_API_KEY`
5. No billing setup required for the free tier — just be aware Google may prompt you to "upgrade," you can ignore this

---

## 5. Resend (email sending)

1. Go to https://resend.com/signup
2. Sign up, verify your email
3. Go to **API Keys** → **Create API Key**, name it `momentum-prod`, copy the value → this is your `RESEND_API_KEY`
4. Go to **Domains** — for sending, you have two options:
   - **Quick start**: use Resend's shared testing domain (works immediately, but emails may look less "official" and have sending limits)
   - **Recommended if you own a domain**: add your domain, follow their DNS verification steps (add a couple of TXT/CNAME records at your domain registrar) — takes ~10 min plus DNS propagation time, gives you a proper "from" address like `you@yourdomain.com`
5. If you don't own a domain and don't want to buy one yet, start with the shared testing domain — you can upgrade this later without any code changes, just an env var update

---

## 6. Reddit — No Signup Needed (Public JSON Feeds)

Originally this required a "script" OAuth app (client ID + secret). That approach has been dropped in favor of Reddit's **public, unauthenticated JSON feeds** — simpler, no account/app creation, no captcha issues to fight through.

**How it works:** any subreddit's posts are available as JSON by just appending `.json` to the URL, no login or key required:

```
https://www.reddit.com/r/startups/top.json?limit=25&t=day
https://www.reddit.com/r/SideProject/new.json?limit=25
https://www.reddit.com/r/travel/top.json?limit=25&t=week
```

**The only requirement:** your app must send a real `User-Agent` header on these requests (e.g., `momentum-app/1.0 by yourusername`) — Reddit blocks requests with missing/generic user agents. This is a code-level detail Claude Code will handle, not something you need to set up here.

**Rate limit awareness:** unauthenticated requests have a lower ceiling (~10 requests/minute is the commonly-used safe limit) than the OAuth API — but since usage here is on-demand, once a day, across a handful of subreddits, this is nowhere near that limit.

**Nothing to copy into `.env.local` for this one.**

---

## 7. YouTube Data API (used by Content Creation Tool)

1. Go to https://console.cloud.google.com
2. Create a new project (top-left project dropdown → **New Project**), name it `momentum`
3. Once created, go to **APIs & Services → Library**
4. Search for **"YouTube Data API v3"**, click it, click **Enable**
5. Go to **APIs & Services → Credentials** → **Create Credentials → API Key**
6. Copy the key → this is your `YOUTUBE_API_KEY`
7. (Optional but recommended) Click **Restrict Key** → under "API restrictions" select "YouTube Data API v3" only — limits what the key can be used for if it ever leaks

---

## 8. Adzuna (job aggregation — used by Jobs Automation Tool)

1. Go to https://developer.adzuna.com/signup
2. Sign up, verify email
3. Your dashboard shows `App ID` and `App Key` immediately — these are your `ADZUNA_APP_ID` and `ADZUNA_APP_KEY`

---

## 9. Jooble (job aggregation — used by Jobs Automation Tool)

1. Go to https://jooble.org/api/about
2. Fill in the short request form (name, email, and a one-line description of use-case — "personal job search tool" is fine)
3. You'll receive an API key by email (usually within minutes, occasionally up to a day)
4. Copy the key from the email → this is your `JOOBLE_API_KEY`

---

## 10. Hunter.io (contact email discovery — used by Jobs Automation Tool)

1. Go to https://hunter.io/users/sign_up
2. Sign up, verify email (free plan gives 25 searches/month — plenty for 10-30 outreach emails/day since you won't look up every single one fresh)
3. Go to **API** section in your dashboard, copy your API key → this is your `HUNTER_API_KEY`

---

## 11. No-Signup Job & Trend Sources (nothing to do here — informational only)

These sources are used directly by the app with **no account, no key, no signup** — listed here just so you know they exist and don't go looking for credentials that don't apply:

- **Hacker News** (Algolia API) — Ideas Tool
- **GitHub Trending** — Ideas Tool
- **Reddit public JSON feeds** — Ideas Tool + Content Creation (see Section 6 above)
- **Greenhouse** (public job board API) — Jobs Automation
- **Lever** (public job board API) — Jobs Automation
- **RemoteOK** (public API) — Jobs Automation
- **Remotive** (public API) — Jobs Automation
- **Arbeitnow** (public API, strong German/EU tech job coverage — useful overlap with your Masters Abroad plans) — Jobs Automation
- **Pinterest Trends** (public trends page, checked periodically) — Content Creation

---

## 12. Assemble Your `.env.local` File

Once you have everything above, create a file called `.env.local` in your project root (Claude Code will create the project structure — you add this file, and **never commit it to git**, it should be in `.gitignore` by default with any Next.js scaffold):

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

GEMINI_API_KEY=

RESEND_API_KEY=

HUNTER_API_KEY=

ADZUNA_APP_ID=
ADZUNA_APP_KEY=

JOOBLE_API_KEY=

YOUTUBE_API_KEY=

CRON_SECRET=generate-a-random-string-here
```

For `CRON_SECRET`, just generate any random string yourself (e.g., run `openssl rand -hex 32` in a terminal, or use any password generator) — this just needs to be a shared secret only your Vercel Cron jobs know, to prevent random internet traffic from triggering your cron endpoints.

---

## 13. When You Deploy to Vercel

After Claude Code has the project working locally, when you connect the repo to Vercel:
1. In Vercel's project import screen, go to **Environment Variables**
2. Paste in every variable from your `.env.local` file (same names, same values)
3. Deploy

Vercel Cron Jobs (for Masters Abroad reminders and Jobs Automation aggregation/sending) are defined in a `vercel.json` file that lives in your repo — Claude Code will create this as part of the build, no separate dashboard setup needed beyond the environment variables above.

---

## Summary Checklist — ✅ All Complete

- [x] GitHub repo created (private, empty)
- [x] Vercel account created, linked to GitHub
- [x] Supabase project created, URL + anon key + service role key saved, one user manually created, two storage buckets created
- [x] Gemini API key obtained
- [x] Resend account + API key obtained
- [x] Google Cloud project created, YouTube Data API v3 enabled, key obtained
- [x] Adzuna App ID + Key obtained
- [x] Jooble API key requested and received
- [x] Hunter.io API key obtained
- [x] All values consolidated into `08-Credentials-Reference.md`

**Reminder:** rotate the Supabase DB password, Adzuna account password, and Hunter.io account password since they were shared in chat — the app itself doesn't use them, only the API keys above.

## No-signup sources — nothing needed, just confirm they're understood
- [ ] Aware that Hacker News, GitHub Trending, Reddit (public JSON), Greenhouse, Lever, RemoteOK, Remotive, Arbeitnow, and Pinterest Trends require zero setup on your end
