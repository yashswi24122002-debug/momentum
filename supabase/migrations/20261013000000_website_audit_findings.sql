-- The raw `issues` column holds Lighthouse's own audit titles/descriptions
-- verbatim — written for web developers ("aria-hidden elements contain
-- focusable descendents"), not useful to a non-technical business owner.
-- `findings` holds the curated, quantified, business-language translation
-- of a handful of the most important ones (Gemini's job, not Lighthouse's)
-- that the report/PDF actually displays.
alter table website_audits add column findings jsonb;
