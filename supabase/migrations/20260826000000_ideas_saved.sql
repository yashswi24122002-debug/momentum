-- "Save for later" — a lightweight bookmark independent of status, so an
-- idea can be flagged as interesting without committing to Approve (which
-- triggers an AI report call) or being lost once it's no longer "today's."

alter table ideas
  add column saved boolean not null default false;
