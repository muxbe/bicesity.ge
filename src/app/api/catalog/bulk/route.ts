import { NextRequest, NextResponse } from "next/server";
import {
  archiveProduct,
  getProductById,
  markAsSold,
  updateProduct,
} from "@/app/api/catalog/catalog-service";
import { catalogErrorResponse } from "@/app/api/catalog/error-response";
import { getCatalogRole } from "@/app/api/catalog/role";
import {
  cancelProductReservation,
  reserveProductForReservation,
} from "@/app/api/reservations/reservation-service";
import { getCurrentPrice } from "@/features/catalog/domain/catalog-discount";
import { getRequestAuth } from "@/lib/auth/server";

type BulkAction =
  | "apply_discount"
  | "remove_discount"
  | "reserve"
  | "cancel_reservation"
  | "mark_sold"
  | "archive";

type BulkPayload = {
  action: BulkAction;
  itemIds: string[];
  payload?: {
    discountInput?: string;
    reason?: string | null;
      reservedForAt?: string;
      expiresAt?: string;
      note?: string | null;
      sellerComment?: string | null;
      customerName?: string | null;
      customerPhone?: string | null;
      messengerProfileUrl?: string | null;
      reservationSource?: "manual" | "messenger" | "phone" | "walk_in" | "other";
      saleChannel?: "online" | "in_store" | "as_is";
      auditNote?: string | null;
  };
};

type BulkResult = {
  success: Array<{ id: string; name: string }>;
  skipped: Array<{ id: string; name?: string; reason: string }>;
};

function isBulkAction(value: unknown): value is BulkAction {
  return (
    value === "apply_discount" ||
    value === "remove_discount" ||
    value === "reserve" ||
    value === "cancel_reservation" ||
    value === "mark_sold" ||
    value === "archive"
  );
}

function canRunAction(role: string | null, action: BulkAction) {
  if (role === "admin") {
    return true;
  }
  return role === "seller" && (action === "reserve" || action === "cancel_reservation");
}

export async function POST(request: NextRequest) {
  try {
    const role = await getCatalogRole(request);
    const body = (await request.json()) as BulkPayload;
    if (!isBulkAction(body.action)) {
      return NextResponse.json({ error: "Unsupported bulk action." }, { status: 400 });
    }
    if (!canRunAction(role, body.action)) {
      return NextResponse.json(
        { error: "This role cannot run the selected bulk action." },
        { status: 403 }
      );
    }

    const auth = await getRequestAuth(request);
    const actorUserId = auth?.user.id;

    const itemIds = Array.from(new Set(body.itemIds ?? [])).filter(Boolean);
    if (itemIds.length === 0) {
      return NextResponse.json({ error: "Select at least one item." }, { status: 400 });
    }

    const result: BulkResult = {
      success: [],
      skipped: [],
    };

    for (const itemId of itemIds) {
      try {
        const product = await getProductById(itemId);
        if (!product) {
          result.skipped.push({ id: itemId, reason: "Product not found." });
          continue;
        }

        if (body.action === "apply_discount" || body.action === "remove_discount") {
          if (product.status === "archived" || product.status === "sold") {
            result.skipped.push({
              id: product.id,
              name: product.name,
              reason: "Sold or deleted items cannot be discounted.",
            });
            continue;
          }

          await updateProduct(product.id, {
            discountInput:
              body.action === "remove_discount" ? "" : body.payload?.discountInput ?? "",
            discountReason: body.payload?.reason ?? null,
          });

          result.success.push({ id: product.id, name: product.name });
          continue;
        }

        if (body.action === "reserve") {
          if (product.status !== "active") {
            result.skipped.push({
              id: product.id,
              name: product.name,
              reason: "Only active items can be reserved.",
            });
            continue;
          }
          if (product.stockCount <= 0) {
            result.skipped.push({
              id: product.id,
              name: product.name,
              reason: "Out-of-stock items cannot be reserved.",
            });
            continue;
          }

          await reserveProductForReservation(
            product.id,
            {
              reservedForAt: body.payload?.reservedForAt,
              expiresAt: body.payload?.expiresAt,
              note: body.payload?.note ?? undefined,
              sellerComment: body.payload?.sellerComment ?? undefined,
              customerName: body.payload?.customerName ?? undefined,
              customerPhone: body.payload?.customerPhone ?? undefined,
              messengerProfileUrl: body.payload?.messengerProfileUrl ?? undefined,
              reservationSource: body.payload?.reservationSource,
            },
            actorUserId
          );
          result.success.push({ id: product.id, name: product.name });
          continue;
        }

        if (body.action === "cancel_reservation") {
          if (product.status !== "reserved") {
            result.skipped.push({
              id: product.id,
              name: product.name,
              reason: "Only reserved items can have reservations cancelled.",
            });
            continue;
          }

          await cancelProductReservation(product.id, body.payload?.note ?? undefined, actorUserId);
          result.success.push({ id: product.id, name: product.name });
          continue;
        }

        if (body.action === "mark_sold") {
          if (product.status === "archived" || product.status === "sold") {
            result.skipped.push({
              id: product.id,
              name: product.name,
              reason: "Deleted or already sold items cannot be marked as sold.",
            });
            continue;
          }
          if (product.stockCount <= 0) {
            result.skipped.push({
              id: product.id,
              name: product.name,
              reason: "Out-of-stock items cannot be marked as sold.",
            });
            continue;
          }

          await markAsSold(product.id, {
            saleChannel: body.payload?.saleChannel ?? "in_store",
            soldPrice: getCurrentPrice(product),
            soldAt: new Date().toISOString(),
            auditNote: body.payload?.auditNote ?? "Bulk sale from inventory page.",
          });
          result.success.push({ id: product.id, name: product.name });
          continue;
        }

        if (body.action === "archive") {
          if (product.status === "archived") {
            result.skipped.push({
              id: product.id,
              name: product.name,
              reason: "Item is already deleted.",
            });
            continue;
          }

          await archiveProduct(product.id);
          result.success.push({ id: product.id, name: product.name });
          continue;
        }

        result.skipped.push({
          id: product.id,
          name: product.name,
          reason: "Unsupported action.",
        });
      } catch (error) {
        result.skipped.push({
          id: itemId,
          reason: error instanceof Error ? error.message : "Action failed.",
        });
      }
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
