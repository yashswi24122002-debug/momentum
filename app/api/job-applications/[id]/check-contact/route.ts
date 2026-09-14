import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/route-guard";
import { findContactsForDomain, guessDomain, domainFromUrl } from "@/lib/integrations/hunter";
import { logError } from "@/lib/errors/log-error";

// Not usage-limited — same reasoning as before this rebuild: it's a
// third-party lookup, not an AI call, and doesn't need a daily cap.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { id } = await params;

  const { data: application, error } = await supabase
    .from("job_applications")
    .select("company, url")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const domain = domainFromUrl(application.url) ?? guessDomain(application.company);
  const { contacts, error: hunterError } = await findContactsForDomain(domain);

  if (hunterError) {
    await logError(supabase, "job-applications/check-contact", hunterError, { applicationId: id, domain });
  }

  return NextResponse.json({ domain, contacts });
}
