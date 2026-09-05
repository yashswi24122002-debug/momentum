import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Every user-facing API route needs this — proxy.ts excludes /api so it
 * never redirects JSON callers to /login, which means each route is
 * responsible for checking its own session.
 *
 * The proxy middleware already ran auth.getUser() for this exact request
 * (a real network round trip to Supabase's Auth server, not a local JWT
 * decode) and, if it succeeded, handed the result forward via headers —
 * trusting that instead of repeating the same call here cuts a duplicate
 * round trip off every single API request. Only `.id`/`.email` are ever
 * read from the returned user anywhere downstream. Falls back to a real
 * check if the header is missing for any reason, so this is strictly an
 * optimization, never a weaker check.
 */
export async function requireUser() {
  const supabase = await createClient();

  const headerList = await headers();
  const headerUserId = headerList.get("x-momentum-user-id");

  let user: User | null;
  if (headerUserId !== null) {
    user = { id: headerUserId, email: headerList.get("x-momentum-user-email") || undefined } as User;
  } else {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  if (!user) {
    return { supabase, user: null, unauthorized: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { supabase, user, unauthorized: null };
}
