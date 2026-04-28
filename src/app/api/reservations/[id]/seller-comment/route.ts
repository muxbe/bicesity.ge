import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth, getRequestStaffRole } from "@/lib/auth/server";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

type SellerCommentPayload = {
  sellerComment?: string;
};

function parseComment(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const role = await getRequestStaffRole(request);
    if (role !== "admin" && role !== "seller") {
      return NextResponse.json(
        { error: "Only admins and sellers can update reservation comments." },
        { status: 403 }
      );
    }

    const payload = (await request.json()) as SellerCommentPayload;
    const sellerComment = parseComment(payload.sellerComment);
    if (sellerComment.length > 2000) {
      return NextResponse.json(
        { error: "Reservation comment must be 2000 characters or fewer." },
        { status: 400 }
      );
    }

    const auth = await getRequestAuth(request);
    const supabase = getServerSupabaseAdminClient();
    const { data, error } = await supabase
      .from("reservations")
      .update({
        seller_comment: sellerComment,
        updated_by_actor_id: auth?.user.id ?? null,
      })
      .eq("id", params.id)
      .select("id,seller_comment,updated_at")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Failed to update reservation comment.", details: error ?? null },
        { status: error?.code === "PGRST116" ? 404 : 500 }
      );
    }

    return NextResponse.json({
      data: {
        id: data.id,
        sellerComment: data.seller_comment ?? "",
        updatedAt: data.updated_at,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected reservation comment error.",
        details: error instanceof Error ? { message: error.message } : null,
      },
      { status: 500 }
    );
  }
}
