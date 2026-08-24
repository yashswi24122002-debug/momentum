import type { SignalResult } from "@/lib/integrations/types";

/** DEV Community public API — no auth required. */
export async function fetchDevToSignals(limit = 15): Promise<SignalResult> {
  const source = "dev.to";
  try {
    const url = `https://dev.to/api/articles?top=7&per_page=${limit}&tag=programming`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!res.ok) {
      return { source, signals: [], error: `HTTP ${res.status}` };
    }

    const json = await res.json();
    const signals: string[] = (json ?? [])
      .map((article: { title?: string }) => article.title)
      .filter((title: string | undefined): title is string => Boolean(title));

    return { source, signals };
  } catch (error) {
    return { source, signals: [], error: error instanceof Error ? error.message : String(error) };
  }
}
