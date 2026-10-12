export type PageSpeedScores = {
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  best_practices: number | null;
};

export type CoreWebVitals = {
  lcp_ms: number | null;
  cls: number | null;
  tbt_ms: number | null;
};

export type PageSpeedIssue = {
  category: "performance" | "seo" | "accessibility" | "best_practices";
  severity: "high" | "medium";
  title: string;
  detail: string;
  value: string | null; // Lighthouse's own human-readable measured value, e.g. "4.4 s", "3 insecure requests found"
};

export type PageSpeedResult = {
  scores: PageSpeedScores;
  vitals: CoreWebVitals;
  issues: PageSpeedIssue[];
  screenshotBase64: string | null; // raw base64, no data: prefix
};

const CATEGORY_KEYS = ["performance", "seo", "accessibility", "best-practices"] as const;

type Audit = { score: number | null; title?: string; description?: string; numericValue?: number; displayValue?: string };
type AuditRef = { id: string; weight: number };
type LighthouseResult = {
  categories?: Record<string, { score: number | null; auditRefs?: AuditRef[] }>;
  audits?: Record<string, Audit & { details?: { data?: string } }>;
};

// Markdown-style `[link text](url)` shows up in Lighthouse audit
// descriptions (they're meant for a web UI that renders them) — stripped
// down to plain text link labels for a plain-text report.
function stripMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

/**
 * One PageSpeed Insights run (mobile strategy — the most revealing for a
 * cold-pitch "your site has problems" angle) covering performance, SEO,
 * accessibility, and best-practices in a single call, plus a free
 * screenshot of the rendered page (no headless browser of our own needed).
 * Never throws — same defensive shape as the other integrations/*.ts
 * wrappers.
 */
export async function runPageSpeedCheck(url: string): Promise<{ result: PageSpeedResult | null; error?: string }> {
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
  if (!apiKey) {
    return { result: null, error: "GOOGLE_PAGESPEED_API_KEY is not configured" };
  }

  try {
    const params = new URLSearchParams({ url, strategy: "mobile", key: apiKey });
    for (const c of CATEGORY_KEYS) params.append("category", c);
    // "final-screenshot" is a big base64 blob not returned unless
    // explicitly asked for via FIELDS — asking for everything instead is
    // simpler and the response is still well within normal payload sizes.

    // Left well short of the route's 60s maxDuration — this call runs
    // alongside the HTML scan, but the route still needs time afterward
    // for the Gemini summary call and the DB write, so this can't eat the
    // whole budget even though PSI itself (a real mobile-throttled page
    // load) can take 30-40s+ against a slow site.
    const response = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, {
      signal: AbortSignal.timeout(40_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { result: null, error: `PageSpeed Insights ${response.status}: ${body.slice(0, 300)}` };
    }

    const data = (await response.json()) as { lighthouseResult?: LighthouseResult };
    const lh = data.lighthouseResult;
    if (!lh) {
      return { result: null, error: "PageSpeed Insights returned no result" };
    }

    const categories = lh.categories ?? {};
    const audits = lh.audits ?? {};

    const scores: PageSpeedScores = {
      performance: categories.performance?.score != null ? Math.round(categories.performance.score * 100) : null,
      seo: categories.seo?.score != null ? Math.round(categories.seo.score * 100) : null,
      accessibility: categories.accessibility?.score != null ? Math.round(categories.accessibility.score * 100) : null,
      best_practices:
        categories["best-practices"]?.score != null ? Math.round(categories["best-practices"].score * 100) : null,
    };

    const vitals: CoreWebVitals = {
      lcp_ms: audits["largest-contentful-paint"]?.numericValue ?? null,
      cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
      tbt_ms: audits["total-blocking-time"]?.numericValue ?? null,
    };

    const categoryNameMap: Record<string, PageSpeedIssue["category"]> = {
      performance: "performance",
      seo: "seo",
      accessibility: "accessibility",
      "best-practices": "best_practices",
    };

    const issues: PageSpeedIssue[] = [];
    for (const [catKey, catLabel] of Object.entries(categoryNameMap)) {
      const refs = categories[catKey]?.auditRefs ?? [];
      const failing = refs
        .map((ref) => ({ ref, audit: audits[ref.id] }))
        .filter((a): a is { ref: AuditRef; audit: Audit } => a.audit != null && a.audit.score != null && a.audit.score < 0.9 && !!a.audit.title)
        .sort((a, b) => b.ref.weight - a.ref.weight)
        .slice(0, 5);

      for (const { audit } of failing) {
        issues.push({
          category: catLabel,
          severity: audit.score! < 0.5 ? "high" : "medium",
          title: audit.title!,
          detail: audit.description ? stripMarkdownLinks(audit.description).slice(0, 400) : "",
          value: audit.displayValue ?? null,
        });
      }
    }

    const screenshotData = audits["final-screenshot"]?.details?.data ?? null;
    const screenshotBase64 = screenshotData?.startsWith("data:") ? screenshotData.split(",")[1] : screenshotData;

    return { result: { scores, vitals, issues, screenshotBase64: screenshotBase64 ?? null } };
  } catch (error) {
    const isTimeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      result: null,
      error: isTimeout
        ? "This site took too long to load for PageSpeed Insights to finish checking it"
        : error instanceof Error
          ? error.message
          : String(error),
    };
  }
}
