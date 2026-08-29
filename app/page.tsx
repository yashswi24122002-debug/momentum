import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/supabase/admin-guard";
import { TOOL_ROUTE_PREFIXES } from "@/lib/admin/tool-routes";
import { TOOL_ORDER } from "@/lib/admin/ui";

// A hardcoded "/habits" redirect here would bounce a member with, say,
// only Calories enabled through the (blocked) Habits page to /no-access —
// technically not a security bug (the middleware still enforces the real
// gate), but confusing for someone whose actual accessible tool is
// something else entirely. This picks their first enabled tool instead.
export default async function Home() {
  const { isAdmin, enabledTools } = await getSessionContext();

  if (isAdmin) {
    redirect("/habits");
  }

  const firstEnabled = TOOL_ORDER.find((tool) => enabledTools.includes(tool));
  redirect(firstEnabled ? TOOL_ROUTE_PREFIXES[firstEnabled][0] : "/no-access");
}
