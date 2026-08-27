export type HunterContact = { email: string; firstName: string | null; lastName: string | null; position: string | null };
export type HunterResult = { contacts: HunterContact[]; error?: string };

/** Hunter.io domain-search — finds likely contact emails for a company's domain. */
export async function findContactsForDomain(domain: string): Promise<HunterResult> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) return { contacts: [], error: "HUNTER_API_KEY not configured" };

  try {
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${apiKey}&limit=10`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return { contacts: [], error: `HTTP ${res.status}` };

    const json = await res.json();
    const contacts: HunterContact[] = (json.data?.emails ?? []).map((e: Record<string, unknown>) => ({
      email: e.value as string,
      firstName: (e.first_name as string) ?? null,
      lastName: (e.last_name as string) ?? null,
      position: (e.position as string) ?? null,
    }));

    return { contacts };
  } catch (error) {
    return { contacts: [], error: error instanceof Error ? error.message : String(error) };
  }
}

/** Best-effort company-name → domain guess, used when a job posting has no URL to derive a domain from. */
export function guessDomain(company: string): string {
  return `${company.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
}
