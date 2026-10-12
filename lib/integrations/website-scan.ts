export type WebsiteScanResult = {
  title: string | null;
  description: string | null;
  has_viewport: boolean;
  https_valid: boolean;
  has_sitemap: boolean;
  has_robots: boolean;
  response_ms: number;
  cms_detected: string | null;
};

// Checked in order — first match wins. Footprints are deliberately simple
// substring checks against the raw HTML rather than a real HTML parser;
// good enough for "what's this site built on", not meant to be exhaustive.
const CMS_FOOTPRINTS: { name: string; test: (html: string) => boolean }[] = [
  { name: "WordPress", test: (h) => h.includes("wp-content") || h.includes("wp-json") },
  { name: "Shopify", test: (h) => h.includes("cdn.shopify.com") },
  { name: "Wix", test: (h) => h.includes("static.wixstatic.com") || h.includes("wix.com") },
  { name: "Squarespace", test: (h) => h.includes("static1.squarespace.com") || h.includes("squarespace.com") },
  { name: "Webflow", test: (h) => h.includes("webflow.com") || h.includes("data-wf-page") },
  { name: "GoDaddy Website Builder", test: (h) => h.includes("godaddysites.com") },
];

function matchAttr(html: string, tagRegex: RegExp): string | null {
  const m = html.match(tagRegex);
  return m ? m[1].trim() : null;
}

/**
 * Direct HTML fetch covering the checks PageSpeed Insights doesn't:
 * CMS fingerprint, meta title/description content (not just presence),
 * and whether robots.txt/sitemap.xml exist at all. Never throws — a
 * failure just means those specific fields come back null/false, same
 * defensive shape as the other integrations/*.ts wrappers.
 */
export async function scanWebsite(url: string): Promise<{ result: WebsiteScanResult | null; error?: string }> {
  try {
    const start = Date.now();
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: "follow" });
    const response_ms = Date.now() - start;

    if (!response.ok) {
      return { result: null, error: `Fetching the site returned ${response.status}` };
    }

    const https_valid = response.url.startsWith("https://");
    const html = await response.text();

    const title = matchAttr(html, /<title[^>]*>([^<]*)<\/title>/i);
    const description =
      matchAttr(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ??
      matchAttr(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
    const has_viewport = /<meta[^>]+name=["']viewport["']/i.test(html);
    const cms_detected = CMS_FOOTPRINTS.find((c) => c.test(html))?.name ?? null;

    const origin = new URL(response.url).origin;
    const [robotsRes, sitemapRes] = await Promise.all([
      fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(8_000) }).catch(() => null),
      fetch(`${origin}/sitemap.xml`, { signal: AbortSignal.timeout(8_000) }).catch(() => null),
    ]);

    return {
      result: {
        title,
        description,
        has_viewport,
        https_valid,
        has_sitemap: sitemapRes?.ok ?? false,
        has_robots: robotsRes?.ok ?? false,
        response_ms,
        cms_detected,
      },
    };
  } catch (error) {
    return { result: null, error: error instanceof Error ? error.message : String(error) };
  }
}
