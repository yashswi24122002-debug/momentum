import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { findContactsForDomain, guessDomain, domainFromUrl } from "@/lib/integrations/hunter";
import { logError } from "@/lib/errors/log-error";

// Separate from draft-outreach so you can see who's actually reachable at a
// company — any role, not just HR/recruiting — before spending an AI call
// drafting to someone auto-picked.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const { data: job, error: jobError } = await supabase.from("job_postings").select("company, url").eq("id", id).single();
  if (jobError || !job) {
    return NextResponse.json({ error: "Job posting not found" }, { status: 404 });
  }

  const domain = domainFromUrl(job.url) ?? guessDomain(job.company);
  const result = await findContactsForDomain(domain);
  if (result.error) {
    await logError(supabase, "jobs/check-contact", `hunter: ${result.error}`, { jobId: id, domain });
  }

  return NextResponse.json({ domain, contacts: result.contacts });
}
