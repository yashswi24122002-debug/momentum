import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/route-guard";
import { checkIsAdmin } from "@/lib/supabase/admin-guard";
import { resolveGeminiApiKey, NoApiKeyError } from "@/lib/admin/resolve-api-key";
import { checkAndIncrementUsage, UsageLimitExceededError } from "@/lib/admin/usage";
import { generateContentAsUser, generateContentWithImageAsUser } from "@/lib/ai/generate-content";
import { runPageSpeedCheck } from "@/lib/integrations/pagespeed";
import { scanWebsite } from "@/lib/integrations/website-scan";
import { logError } from "@/lib/errors/log-error";
import type { BusinessLead } from "@/lib/types/leads";

const DOCUMENTS_BUCKET = "documents";

// PageSpeed Insights alone can take 20-40s against a slow site; bounded to
// stay comfortably under Vercel's 60s ceiling (this route sets its own
// maxDuration below) even with the website scan and Gemini call on top.
export const maxDuration = 60;

const SummarySchema = z.object({
  summary: z
    .string()
    .describe(
      "3-5 sentences, plain prose, prioritized narrative of the biggest problems with this website and why they'd matter to this specific business (losing customers, looking untrustworthy, not showing up in search, etc). Reference the screenshot for visual/design observations (cluttered layout, outdated look, unclear call-to-action) alongside the technical findings given — be specific to what's actually visible and measured, not generic website advice."
    ),
});

function buildSummaryPrompt(
  lead: Pick<BusinessLead, "name" | "category">,
  pagespeed: Awaited<ReturnType<typeof runPageSpeedCheck>>["result"],
  scan: Awaited<ReturnType<typeof scanWebsite>>["result"]
): string {
  return `Write a prioritized, plain-English summary of what's wrong with ${lead.name}'s website (a ${lead.category ?? "local business"}), based on this real data:

PageSpeed Insights scores (0-100, higher is better): ${JSON.stringify(pagespeed?.scores ?? "unavailable")}
Core Web Vitals: ${JSON.stringify(pagespeed?.vitals ?? "unavailable")}
Failing checks: ${JSON.stringify(pagespeed?.issues ?? [])}
Page info: ${JSON.stringify(scan ?? "unavailable")}

A screenshot of the site as it actually renders is attached — use it for visual/design observations the data above can't capture.`;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const isAdmin = await checkIsAdmin(supabase, user);
  try {
    await resolveGeminiApiKey(user.id, isAdmin);
    await checkAndIncrementUsage(supabase, user.id, "leads_analyze_website", isAdmin);
  } catch (error) {
    if (error instanceof NoApiKeyError || error instanceof UsageLimitExceededError) {
      return NextResponse.json({ error: error.message }, { status: error instanceof UsageLimitExceededError ? 429 : 403 });
    }
    throw error;
  }

  const { id } = await params;

  const { data: lead, error: leadError } = await supabase
    .from("business_leads")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  if (!lead.existing_website) {
    return NextResponse.json({ error: "This lead has no website to analyze" }, { status: 400 });
  }

  const [{ result: pagespeed, error: pagespeedError }, { result: scan, error: scanError }] = await Promise.all([
    runPageSpeedCheck(lead.existing_website),
    scanWebsite(lead.existing_website),
  ]);

  if (!pagespeed && !scan) {
    const combinedError = [pagespeedError, scanError].filter(Boolean).join("; ");
    await logError(supabase, "leads/analyze-website", combinedError, { leadId: id, url: lead.existing_website });
    const { data: failed } = await supabase
      .from("website_audits")
      .insert({
        lead_id: id,
        url: lead.existing_website,
        status: "failed",
        error: combinedError,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();
    return NextResponse.json({ error: combinedError || "Couldn't reach that website", audit: failed }, { status: 502 });
  }

  let screenshotPath: string | null = null;
  if (pagespeed?.screenshotBase64) {
    const path = `${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(path, Buffer.from(pagespeed.screenshotBase64, "base64"), { contentType: "image/jpeg" });
    if (!uploadError) screenshotPath = path;
  }

  let aiSummary: string | null = null;
  try {
    const prompt = buildSummaryPrompt(lead, pagespeed, scan);
    const { summary } = pagespeed?.screenshotBase64
      ? await generateContentWithImageAsUser(user.id, isAdmin, prompt, SummarySchema, {
          mimeType: "image/jpeg",
          base64: pagespeed.screenshotBase64,
        })
      : await generateContentAsUser(user.id, isAdmin, prompt, SummarySchema);
    aiSummary = summary;
  } catch (error) {
    // Degrade gracefully — the raw scores/issues below are still useful
    // without the narrative, so a Gemini hiccup doesn't fail the whole
    // analysis.
    await logError(supabase, "leads/analyze-website", error instanceof Error ? error.message : String(error), { leadId: id });
  }

  const { data: audit, error: insertError } = await supabase
    .from("website_audits")
    .insert({
      lead_id: id,
      url: lead.existing_website,
      status: "completed",
      scores: pagespeed?.scores ?? null,
      core_web_vitals: pagespeed?.vitals ?? null,
      screenshot_path: screenshotPath,
      issues: pagespeed?.issues ?? [],
      cms_detected: scan?.cms_detected ?? null,
      meta: scan
        ? {
            title: scan.title,
            description: scan.description,
            has_viewport: scan.has_viewport,
            https_valid: scan.https_valid,
            has_sitemap: scan.has_sitemap,
            has_robots: scan.has_robots,
            response_ms: scan.response_ms,
          }
        : null,
      ai_summary: aiSummary,
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ audit });
}
