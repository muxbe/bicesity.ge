import { NextRequest, NextResponse } from "next/server";
import { createField, listFields } from "@/app/api/fields/field-service";
import { getCatalogRole, requireAdmin } from "@/app/api/catalog/role";
import { DomainError } from "@/features/shared/domain/errors";
import type { CreateFieldDTO } from "@/features/fields/dto/field-dto";

function parseCategory(value: string | null): "Bicycle" | "Parts" | "all" {
  if (value === "Bicycle" || value === "Parts") {
    return value;
  }
  return "all";
}

function errorResponse(error: unknown) {
  if (error instanceof DomainError) {
    const status = error.code === "VALIDATION_ERROR" ? 400 : error.code === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details ?? null,
      },
      { status }
    );
  }

  return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const category = parseCategory(request.nextUrl.searchParams.get("category"));
    const role = await getCatalogRole(request);
    const fields = await listFields(category);
    return NextResponse.json({
      data: role ? fields : fields.filter((field) => field.isPublic && !field.archivedAt),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const denied = await requireAdmin(request);
    if (denied) {
      return denied;
    }

    const payload = (await request.json()) as CreateFieldDTO;
    const field = await createField(payload);
    return NextResponse.json({ data: field }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
