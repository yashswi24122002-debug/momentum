import * as cheerio from "cheerio";
import type { SignalResult } from "@/lib/integrations/types";

/**
 * GitHub has no official trending API — this does a lightweight scrape of
 * the public trending page, per the Ideas Tool PRD §3. If GitHub changes
 * their markup this degrades to zero signals rather than throwing, so
 * generation still proceeds on the remaining sources (Master PRD §6).
 */
export async function fetchGitHubTrendingSignals(limit = 15): Promise<SignalResult> {
  const source = "github-trending";
  try {
    const res = await fetch("https://github.com/trending?since=daily", {
      headers: { "User-Agent": "momentum-app/1.0 (personal project idea generator)" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return { source, signals: [], error: `HTTP ${res.status}` };
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const signals: string[] = [];

    $("article.Box-row").each((_, el) => {
      if (signals.length >= limit) return;
      const repo = $(el).find("h2 a").attr("href")?.replace(/^\//, "").trim();
      const description = $(el).find("p").first().text().trim();
      if (repo) signals.push(description ? `${repo}: ${description}` : repo);
    });

    return { source, signals };
  } catch (error) {
    return { source, signals: [], error: error instanceof Error ? error.message : String(error) };
  }
}
