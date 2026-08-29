import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // /api/* is now included (unlike before) — updateSession() itself
  // returns JSON instead of redirecting for API paths, and skips
  // /api/cron/* entirely (those authenticate via CRON_SECRET, not a user
  // session). This is what lets tool-access and admin gating be enforced
  // centrally for both pages and API routes, rather than edited into every
  // individual route file.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
