/**
 * Jobs Automation config — Master PRD §5: Greenhouse/Lever need a
 * per-company board slug (no "search all" endpoint), so this is a
 * maintained list, same pattern the PRD itself prescribes ("start with a
 * handful of companies you're interested in and expand the list over
 * time"). Every slug below was verified live against the real API before
 * being added.
 *
 * Fit-scoring keywords default to this resume's actual skills rather than
 * generic terms — edit freely as the job search focus shifts.
 */

// Greenhouse: verified working boards as of the initial build.
export const GREENHOUSE_COMPANIES = [
  "stripe",
  "airbnb",
  "figma",
  "anthropic",
  "databricks",
  "coinbase",
  "cloudflare",
  "discord",
  "datadog",
  "robinhood",
  "twilio",
  "vercel",
  "pinterest",
  "asana",
];

// Lever: most large tech companies have moved off Lever, so this list is
// short by nature — Palantir is the one verified board found at build
// time. Add more as you discover working ones (test with
// `https://api.lever.co/v0/postings/{slug}?mode=json`).
export const LEVER_COMPANIES = ["palantir"];

// Adzuna requires a country code per request — "in" matches this resume's
// location (Noida). Change to your target market.
export const ADZUNA_COUNTRY = "in";

// Software engineering roles only — general SWE/SDE, frontend, backend,
// full-stack/MERN, plus technical PM and forward-deployed engineer.
// Non-matching roles (sales, marketing, etc.) are hard-filtered out by
// computeFitScore, not just soft-ranked, so keep this list to titles that
// are actually a fit.
export const ROLE_KEYWORDS = [
  "software engineer",
  "software developer",
  "sde",
  "full stack",
  "fullstack",
  "mern",
  "backend",
  "back end",
  "frontend",
  "front end",
  "web developer",
  "technical product manager",
  "forward deployed engineer",
  "fde",
];

// Used for both aggregation search terms and fit-score matching —
// sourced from the resume on file (React/Node/AI-integration background).
export const TECH_STACK_KEYWORDS = [
  "javascript",
  "typescript",
  "react",
  "reactjs",
  "redux",
  "node.js",
  "nodejs",
  "express",
  "rest api",
  "graphql",
  "mongodb",
  "firebase",
  "redis",
  "openai",
  "llm",
  "ai integration",
  "websockets",
  "python",
];
