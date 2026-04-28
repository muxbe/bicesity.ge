import { NextRequest, NextResponse } from "next/server";
import { archiveField, updateField } from "@/app/api/fields/field-service";
import { requireAdmin } from "@/app/api/catalog/role";
import { DomainError } from "@/features/shared/domain/errors";
import type { UpdateFieldDTO } from "@/features/fields/dto/field-dto";

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const denied = await requireAdmin(request);
    if (denied) {
      return denied;
    }

    const payload = (await request.json()) as UpdateFieldDTO;
    const field = await updateField(params.id, payload);
    return NextResponse.json({ data: field });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const denied = await requireAdmin(request);
    if (denied) {
      return denied;
    }

    await archiveField(params.id);
    return NextResponse.json({ data: { archived: true } });
  } catch (error) {
    return errorResponse(error);
  }
}
