import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveToolForPath } from "@/lib/admin/tool-routes";

const PUBLIC_PATHS = ["/login"];

/**
 * 09-Admin-Access-Control-PRD.md §7/§12: this is the one centralized
 * enforcement point for admin gating, forced password change, and per-tool
 * access — covering both pages and API routes (except /api/cron/*, which
 * authenticates via CRON_SECRET inside the route itself, not a user
 * session). Individual routes' own requireUser()/requireAdmin() calls stay
 * exactly as they are; this is an earlier, additional layer, not a
 * replacement for them.
 */
export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/api/cron/")) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });
  const isApiPath = pathname.startsWith("/api/");

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  function deny(status: 401 | 403, message: string, redirectTo = "/login") {
    if (isApiPath) return NextResponse.json({ error: message }, { status });
    const url = request.nextUrl.clone();
    url.pathname = redirectTo;
    return NextResponse.redirect(url);
  }

  if (!user && !isPublicPath) {
    return deny(401, "Unauthorized");
  }

  if (user && pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/"; // resolves to this member's first enabled tool, not a hardcoded one
    return NextResponse.redirect(homeUrl);
  }

  if (user && !isPublicPath) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, email, must_change_password")
      .eq("id", user.id)
      .single();

    const isAdmin = profile?.role === "admin" && profile.email === process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;

    const isAdminPath = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
    if (isAdminPath && !isAdmin) {
      return deny(403, "Forbidden", "/no-access");
    }

    // Also exempts /api/me/change-password itself — otherwise the page's
    // own submit call (which is what flips must_change_password off) would
    // be blocked by the very flag it exists to clear.
    if (profile?.must_change_password && pathname !== "/change-password" && pathname !== "/api/me/change-password") {
      if (isApiPath) return deny(403, "Password change required");
      const url = request.nextUrl.clone();
      url.pathname = "/change-password";
      return NextResponse.redirect(url);
    }

    if (!isAdmin && !isAdminPath) {
      const tool = resolveToolForPath(pathname);
      if (tool) {
        const { data: access } = await supabase
          .from("tool_access")
          .select("enabled")
          .eq("user_id", user.id)
          .eq("tool_key", tool)
          .maybeSingle();

        if (!access?.enabled) {
          return deny(403, "This tool isn't enabled for your account", "/no-access");
        }
      }
    }
  }

  return supabaseResponse;
}
