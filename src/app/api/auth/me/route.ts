import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth } from "@/lib/auth/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await getRequestAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    return NextResponse.json({
      data: {
        userId: auth.user.id,
        email: auth.user.email ?? auth.profile?.email ?? "",
        fullName: auth.profile?.fullName ?? "",
        role: auth.role,
        isActive: auth.profile?.isActive ?? (auth.role === "admin" || auth.role === "seller"),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load current profile.",
        details: error instanceof Error ? { message: error.message } : null,
      },
      { status: 500 }
    );
  }
}
