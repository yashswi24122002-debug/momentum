import type { ToolKey } from "@/lib/types/admin";

// 09-Admin-Access-Control-PRD.md §7/§12: maps both page and API paths to
// the tool that gates them, enforced centrally in middleware rather than
// by editing every route file individually — a request for a tool the
// member doesn't have gets rejected here regardless of which specific
// route it hits.
export const TOOL_ROUTE_PREFIXES: Record<ToolKey, string[]> = {
  habits: ["/habits", "/api/habits", "/api/weekly-todos"],
  ideas: ["/ideas", "/api/ideas", "/api/idea-reports"],
  content: ["/content", "/api/content", "/api/content-reports", "/api/media", "/api/trips"],
  masters_abroad: ["/masters-abroad", "/api/universities", "/api/tasks", "/api/documents"],
  jobs: ["/jobs", "/api/jobs", "/api/outreach", "/api/applications", "/api/resumes"],
  calories: ["/calories", "/api/calories"],
};

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Returns which tool (if any) gates this path — null for anything not tool-scoped (home, admin, auth pages, etc.). */
export function resolveToolForPath(pathname: string): ToolKey | null {
  for (const [tool, prefixes] of Object.entries(TOOL_ROUTE_PREFIXES) as [ToolKey, string[]][]) {
    if (prefixes.some((prefix) => matchesPrefix(pathname, prefix))) return tool;
  }
  return null;
}
