-- Lets one outreach email go to more than one person at the same
-- business (e.g. info@ and the owner's personal address) instead of only
-- the single business_leads.email — editable per-outreach in the queue,
-- combined with the lead's primary email into the "to" list at send time.
alter table lead_outreach add column additional_emails text[] not null default '{}';
