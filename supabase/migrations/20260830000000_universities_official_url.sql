-- Real official program page URL, matched against a curated lookup of
-- verified German university cybersecurity programs at discovery time
-- (lib/masters-abroad/curated-universities.ts) — never AI-generated,
-- since Gemini has no browsing access and reliably hallucinates URLs.
-- Falls back to a real Google search link for anything outside the
-- curated set, never a fabricated .edu-looking URL.

alter table universities
  add column official_url text;
