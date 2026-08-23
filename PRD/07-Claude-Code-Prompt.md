# Prompt for Claude Code

Copy everything below the line into Claude Code (in your project's terminal/VS Code extension) after you've completed the Setup Guide and have your `.env.local` values ready. Make sure all the PRD `.md` files are in your project folder (e.g., a `/docs` folder) before running this, since the prompt references them.

---

I'm building a personal, single-user web application called **Momentum**. I have a complete set of PRD documents in the `/docs` folder of this repo:

- `00-Master-PRD.md` — overall architecture, tech stack, design system, build phasing
- `01-Ideas-Tool-PRD.md`
- `02-Masters-Abroad-PRD.md`
- `03-Jobs-Automation-PRD.md`
- `04-Habit-Tracker-PRD.md`
- `05-Content-Creation-PRD.md`
- `08-Credentials-Reference.md` — contains my actual API keys and secrets

Please start by reading `00-Master-PRD.md` in full, then read each individual tool PRD. Don't start writing code until you've read all documents.

**First thing to do:** create a `.env.local` file at the project root using the exact contents of `08-Credentials-Reference.md`, then confirm `.env.local` is listed in `.gitignore` before anything is committed. After that, tell me to delete or move `08-Credentials-Reference.md` out of the repo folder, since it's no longer needed once `.env.local` exists and it should never be committed.

**How I want you to work:**

1. **Follow the build phasing in the Master PRD exactly** (Foundation → Habit Tracker → Ideas Tool → Content Creation → Masters Abroad → Jobs Automation). Don't jump ahead to a later tool before an earlier one is working end-to-end.

2. **Foundation phase specifically should include:**
   - Next.js 14+ App Router scaffold with TypeScript
   - Tailwind CSS + shadcn/ui configured with the exact design tokens (colors, fonts) specified in the Master PRD's Design System section — dark theme, emerald/teal accent
   - Supabase client setup (both browser and server-side helpers) using the values already in `.env.local`
   - Supabase Auth login gate — single-user email/password, no public sign-up route
   - App shell: bottom tab bar on mobile, sidebar on desktop, with 5 tabs matching the 5 tools, each currently pointing to an empty state page
   - Set up the Supabase migrations folder with SQL files for all tables across all 5 tools (pull the schema directly from each tool's PRD) — run these as one initial migration

3. **For each tool**, implement in this order: data model (migration) → API routes → UI pages → wire them together. Match the API route paths, request/response shapes, and data models specified in that tool's PRD exactly — don't improvise a different schema.

4. **External integrations**: build each one (Hacker News, Reddit, Greenhouse/Lever, Adzuna, Hunter.io, Gemini, Resend, YouTube Data API, Google Trends) as an isolated wrapper module under `lib/integrations/` with a clean function signature, so each one can fail independently without crashing the whole request — per the Master PRD's error handling section.

5. **AI calls**: put all Gemini calls behind a single function `generateContent(prompt, schema)` in `lib/ai/` so the provider is swappable later. Use structured/JSON output mode where Gemini supports it, and validate the response shape before saving to the database — if it doesn't match, retry once, then fail gracefully with a clear error rather than saving malformed data.

6. **Mobile-first**: build every screen for a ~375px viewport first, then adapt for desktop. Reference the Master PRD's layout principles (cards over tables on mobile, persistent bottom nav, etc.)

7. **Ask me before making assumptions on anything not covered in the PRDs** — these documents are thorough but if you hit a genuine gap (e.g., exact copy/wording for an empty state, or a design detail not specified), ask rather than guessing, especially for anything that would be expensive to redo later (schema design, API contracts).

8. **After the Foundation phase is working**, stop and let me test it locally before moving to the first tool (Habit Tracker) — I want to confirm auth and navigation work end-to-end before we build on top of it.

9. **Git**: commit at the end of each meaningful chunk (foundation, then each tool) with clear commit messages, so I have clean rollback points.

Let's start with the Foundation phase. Ask me for any `.env.local` values you need before proceeding, and confirm your understanding of the design system before you scaffold the UI shell.
