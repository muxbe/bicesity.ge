import { NextRequest, NextResponse } from "next/server";
import { getRequestStaffRole } from "@/lib/auth/server";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

type ExpirePayload = {
  referenceTimeIso?: string;
};

export async function POST(request: NextRequest) {
  try {
    const role = await getRequestStaffRole(request);
    if (role !== "admin" && role !== "seller") {
      return NextResponse.json(
        { error: "Only admins and sellers can expire reservations." },
        { status: 403 }
      );
    }

    const payload = (await request.json().catch(() => ({}))) as ExpirePayload;
    const nowIso = payload.referenceTimeIso ?? new Date().toISOString();
    const supabase = getServerSupabaseAdminClient();
    const { data, error } = await supabase
      .from("reservations")
      .update({
        status: "expired",
        cancellation_reason_code: "expired",
        cancellation_note: "Automatically expired.",
      })
      .eq("status", "active")
      .lt("expires_at", nowIso)
      .select("id");

    if (error) {
      return NextResponse.json(
        { error: "Failed to expire old reservations.", details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { expiredCount: (data ?? []).length } });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected reservation expiry error.",
        details: error instanceof Error ? { message: error.message } : null,
      },
      { status: 500 }
    );
  }
}
