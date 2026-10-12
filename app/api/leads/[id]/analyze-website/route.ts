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

// The reader is a non-technical business owner, not a developer — the
// whole point of this schema is translating raw Lighthouse jargon
// ("aria-hidden elements contain focusable descendents") into something a
// founder can actually act on, with real measured numbers next to a real
// benchmark instead of a vague "this is slow."
const AnalysisSchema = z.object({
  summary: z
    .string()
    .describe(
      "3-5 sentences, plain prose, written like a consultant's opening paragraph to the business owner — prioritized, specific to what's actually visible and measured (not generic website advice), explaining why it matters in business terms (losing customers, looking untrustworthy, not showing up in search). Reference the screenshot for visual/design observations alongside the technical findings."
    ),
  findings: z
    .array(
      z.object({
        headline: z.string().describe("A short, plain-English problem name a non-technical person understands immediately, e.g. 'Your website is slow to load' — never Lighthouse's own technical audit name."),
        your_value: z
          .string()
          .describe("The actual measured value for THIS site, in plain terms, e.g. '9.4 seconds' or '3 insecure requests'. Only state a number that was actually given in the data below — never invent one."),
        good_benchmark: z
          .string()
          .describe("What a well-optimized site looks like for this same thing, using the standard benchmarks given below where one exists (e.g. 'under 3.4 seconds'). If this particular check has no numeric benchmark, describe the good state in plain words instead (e.g. 'links should describe where they lead') rather than inventing a fake number."),
        business_impact: z
          .string()
          .describe("One sentence, plain English, no jargon, on what this actually costs the business (lost visitors, lower Google ranking, looking untrustworthy, etc)."),
      })
    )
    .min(3)
    .max(6)
    .describe("The 3-6 MOST IMPORTANT problems only, picked and prioritized by you — not every failing check, just the ones that would actually matter to this business."),
});

const STANDARD_BENCHMARKS = `Standard "good" thresholds for the metrics that have them (Google's own published thresholds — state these accurately, don't make up different numbers):
- Largest Contentful Paint (main content visible): good is under 2.5s, poor is over 4s
- First Contentful Paint (something visible at all): good is under 1.8s
- Speed Index (how quickly the page visibly fills in): good is under 3.4s
- Total Blocking Time (page responsiveness while loading): good is under 200ms
- Cumulative Layout Shift (visual stability): good is under 0.1`;

function buildSummaryPrompt(
  lead: Pick<BusinessLead, "name" | "category">,
  pagespeed: Awaited<ReturnType<typeof runPageSpeedCheck>>["result"],
  scan: Awaited<ReturnType<typeof scanWebsite>>["result"]
): string {
  return `Write a business-friendly summary and findings for ${lead.name}'s website (a ${lead.category ?? "local business"}), based on this real data. The reader is the business owner — assume no technical knowledge.

PageSpeed Insights scores (0-100, higher is better): ${JSON.stringify(pagespeed?.scores ?? "unavailable")}
Core Web Vitals (raw): ${JSON.stringify(pagespeed?.vitals ?? "unavailable")}
Failing checks, each with Lighthouse's own measured value where one exists: ${JSON.stringify(pagespeed?.issues ?? [])}
Page info: ${JSON.stringify(scan ?? "unavailable")}

${STANDARD_BENCHMARKS}

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

  // Every failure gets logged, even a partial one (e.g. the HTML scan
  // succeeding while PageSpeed times out) — previously only the "both
  // failed" case was recorded anywhere, so a partial failure silently
  // produced a near-empty report with no visible explanation.
  const partialErrors = [
    pagespeedError ? `PageSpeed Insights: ${pagespeedError}` : null,
    scanError ? `Page scan: ${scanError}` : null,
  ].filter((e): e is string => e !== null);
  if (partialErrors.length > 0) {
    await logError(supabase, "leads/analyze-website", partialErrors.join(" | "), { leadId: id, url: lead.existing_website });
  }

  if (!pagespeed && !scan) {
    const combinedError = partialErrors.join("; ");
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
  let findings: z.infer<typeof AnalysisSchema>["findings"] | null = null;
  try {
    const prompt = buildSummaryPrompt(lead, pagespeed, scan);
    const result = pagespeed?.screenshotBase64
      ? await generateContentWithImageAsUser(user.id, isAdmin, prompt, AnalysisSchema, {
          mimeType: "image/jpeg",
          base64: pagespeed.screenshotBase64,
        })
      : await generateContentAsUser(user.id, isAdmin, prompt, AnalysisSchema);
    aiSummary = result.summary;
    findings = result.findings;
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
      findings,
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
      // Reused even on a "completed" row — a note on what couldn't be
      // checked, not just a failure-status field, so the report can say
      // *why* a section is missing instead of just omitting it silently.
      error: partialErrors.length > 0 ? partialErrors.join(" | ") : null,
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ audit });
}
