import type { RawJobPosting } from "@/lib/types/jobs";
import type { JobSourceResult } from "@/lib/integrations/greenhouse";

/**
 * hiring.cafe — itself a large job aggregator (Avature, Workday, Greenhouse,
 * etc. behind the scenes) with unusually rich structured data embedded
 * directly in the homepage's Next.js SSR payload (a `__NEXT_DATA__` script
 * tag, no API call needed). Its robots.txt explicitly allows crawling the
 * bare "/" path but disallows any `?searchState=` or `?page=` query string
 * (their search/pagination), so this fetches only the default homepage
 * listing once — geo-targeted server-side (India, from this deployment's
 * IP), unfiltered by role — same firehose-then-filter pattern as RemoteOK.
 * computeFitScore's role-title and experience gates do the actual
 * filtering downstream; this source's min_industry_and_role_yoe field
 * feeds the experience gate directly rather than via regex extraction.
 */
export async function fetchHiringCafeJobs(): Promise<JobSourceResult> {
  const source = "hiringcafe";
  try {
    const res = await fetch("https://hiringcafe.com/", {
      headers: { "User-Agent": "Momentum (personal job search tool)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { source, postings: [], error: `HTTP ${res.status}` };

    const html = await res.text();
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match) return { source, postings: [], error: "Could not find embedded job data (page structure may have changed)" };

    const data = JSON.parse(match[1]);
    const hits = data?.props?.pageProps?.ssrHits;
    if (!Array.isArray(hits)) return { source, postings: [], error: "Unexpected page structure" };

    const postings: RawJobPosting[] = hits.map((raw: unknown) => {
      const h = raw as Record<string, unknown>;
      const v5 = (h.v5_processed_job_data ?? {}) as Record<string, unknown>;
      const enrichedCompany = h.enriched_company_data as { name?: string } | undefined;
      const attributedOrg = h.attributed_org as { name?: string } | undefined;
      const jobInformation = h.job_information as { title?: string } | undefined;
      const publishDate = v5.estimated_publish_date as string | undefined;
      const minYoe = v5.min_industry_and_role_yoe;
      const countries = v5.workplace_countries;

      return {
        source,
        company: enrichedCompany?.name ?? attributedOrg?.name ?? (v5.company_name as string) ?? "Unknown",
        role_title: jobInformation?.title ?? (v5.core_job_title as string) ?? "Unknown role",
        location: (v5.formatted_workplace_location as string) ?? null,
        remote: v5.workplace_type === "Remote",
        url: (h.apply_url as string) ?? null,
        description_raw: (v5.requirements_summary as string) ?? null,
        tech_stack_tags: Array.isArray(v5.technical_tools) ? (v5.technical_tools as string[]) : [],
        posted_date: publishDate ? publishDate.slice(0, 10) : null,
        min_years_experience: typeof minYoe === "number" ? minYoe : null,
        workplace_country: Array.isArray(countries) && typeof countries[0] === "string" ? countries[0] : null,
      };
    });

    return { source, postings };
  } catch (error) {
    return { source, postings: [], error: error instanceof Error ? error.message : String(error) };
  }
}
