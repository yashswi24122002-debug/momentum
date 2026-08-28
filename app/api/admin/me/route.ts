import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-guard";

export async function GET() {
  const { profile, unauthorized } = await requireAdmin();
  if (unauthorized) return unauthorized;

  return NextResponse.json({ profile });
}
