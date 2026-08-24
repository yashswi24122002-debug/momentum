import type { SignalResult } from "@/lib/integrations/types";

/** Lobste.rs public JSON feed — no auth required, tech-community-curated. */
export async function fetchLobstersSignals(limit = 15): Promise<SignalResult> {
  const source = "lobsters";
  try {
    const res = await fetch("https://lobste.rs/hottest.json", {
      headers: { "User-Agent": "momentum-app/1.0 (personal project idea generator)" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return { source, signals: [], error: `HTTP ${res.status}` };
    }

    const json = await res.json();
    const signals: string[] = (json ?? [])
      .slice(0, limit)
      .map((story: { title?: string }) => story.title)
      .filter((title: string | undefined): title is string => Boolean(title));

    return { source, signals };
  } catch (error) {
    return { source, signals: [], error: error instanceof Error ? error.message : String(error) };
  }
}
