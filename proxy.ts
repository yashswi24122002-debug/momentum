import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // API routes handle their own auth (session check for user-facing routes,
  // CRON_SECRET for cron routes) — a redirect to /login would be the wrong
  // response shape for a JSON caller, so they're excluded here.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
