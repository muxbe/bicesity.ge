import { NextRequest, NextResponse } from "next/server";
import { getFallbackImage, normalizeProductImage } from "@/features/catalog";
import type { ProductCategory } from "@/features/catalog/dto/catalog-dto";
import {
  buildPreviousReportDateRange,
  resolveReportDateRange,
} from "@/features/reports/domain/report-date-range";
import type { OperationalReportDTO, SalesTrendPoint } from "@/features/reports/dto/report-dto";
import { getRequestStaffRole } from "@/lib/auth/server";
import { getServerSupabaseAdminClient } from "@/lib/supabase/admin";

type SaleRow = {
  id: string;
  catalog_item_id: string;
  sale_price_cents: number;
  sold_at: string;
  catalog_items:
    | {
        id: string;
        name: string;
        item_type: "bicycle" | "part";
        product_images:
          | {
              bucket_name: string | null;
              object_path: string | null;
              external_url: string | null;
              is_primary: boolean;
              sort_order: number;
            }[]
          | null;
      }
    | {
        id: string;
        name: string;
        item_type: "bicycle" | "part";
        product_images:
          | {
              bucket_name: string | null;
              object_path: string | null;
              external_url: string | null;
              is_primary: boolean;
              sort_order: number;
            }[]
          | null;
      }[]
    | null;
};

type ReservationRow = {
  status: "active" | "completed" | "cancelled" | "expired";
  reserved_for_at: string;
};

function mapCategory(itemType: "bicycle" | "part"): ProductCategory {
  return itemType === "bicycle" ? "Bicycle" : "Parts";
}

function storagePublicUrl(bucket: string | null | undefined, objectPath: string | null | undefined) {
  const trimmedBucket = bucket?.trim();
  const trimmedPath = objectPath?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!trimmedBucket || !trimmedPath || !supabaseUrl) {
    return "";
  }

  const encodedPath = trimmedPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(trimmedBucket)}/${encodedPath}`;
}

function pickImage(
  images:
    | {
        bucket_name: string | null;
        object_path: string | null;
        external_url: string | null;
        is_primary: boolean;
        sort_order: number;
      }[]
    | null,
  category: ProductCategory
) {
  if (!images || images.length === 0) {
    return getFallbackImage(category);
  }

  const ordered = [...images].sort((a, b) => a.sort_order - b.sort_order);
  const primary = ordered.find(
    (image) => image.is_primary && (image.external_url || image.object_path)
  );
  const selected = primary ?? ordered.find((image) => image.external_url || image.object_path);
  const source = selected?.external_url?.trim() ||
    storagePublicUrl(selected?.bucket_name, selected?.object_path);
  return normalizeProductImage(source, category);
}

function formatBucketLabel(start: Date, endExclusive: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const inclusiveEnd = new Date(endExclusive.getTime() - 1);
  const startLabel = formatter.format(start);
  const endLabel = formatter.format(inclusiveEnd);
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
}

function computeSalesSeries(
  sales: SaleRow[],
  startIso: string,
  endIsoExclusive: string,
  dayCount: number
): SalesTrendPoint[] {
  const start = new Date(startIso);
  const endExclusive = new Date(endIsoExclusive);
  const dayMs = 24 * 60 * 60 * 1000;
  const bucketCount = Math.min(dayCount, 6);
  const bucketSize = Math.max(1, Math.ceil(dayCount / bucketCount));
  const points: SalesTrendPoint[] = [];

  for (let index = 0; index < bucketCount; index += 1) {
    const bucketStart = new Date(start.getTime() + index * bucketSize * dayMs);
    const bucketEnd = new Date(
      Math.min(endExclusive.getTime(), bucketStart.getTime() + bucketSize * dayMs)
    );
    const sum = sales
      .filter((sale) => {
        const soldAt = new Date(sale.sold_at);
        return soldAt >= bucketStart && soldAt < bucketEnd;
      })
      .reduce((acc, sale) => acc + sale.sale_price_cents / 100, 0);

    points.push({
      label: formatBucketLabel(bucketStart, bucketEnd),
      value: Math.round(sum),
    });
  }

  return points;
}

function comparisonMetric(currentValue: number, previousValue: number) {
  const changeValue = currentValue - previousValue;
  if (previousValue === 0) {
    return {
      previousValue,
      changeValue,
      changePercent: currentValue === 0 ? 0 : null,
    };
  }

  return {
    previousValue,
    changeValue,
    changePercent: Math.round((changeValue / previousValue) * 100),
  };
}

function buildOperationalReport(
  sales: SaleRow[],
  previousSales: SaleRow[],
  reservations: ReservationRow[],
  previousReservations: ReservationRow[],
  now: Date,
  input: { startDate?: string; endDate?: string }
): OperationalReportDTO {
  const dateRange = resolveReportDateRange(input, now);
  const previousDateRange = buildPreviousReportDateRange(dateRange, now);
  const revenue = sales.reduce((sum, sale) => sum + sale.sale_price_cents / 100, 0);
  const unitsSold = sales.length;
  const avgOrderValue = unitsSold > 0 ? Math.round(revenue / unitsSold) : 0;
  const previousRevenue = previousSales.reduce(
    (sum, sale) => sum + sale.sale_price_cents / 100,
    0
  );
  const previousUnitsSold = previousSales.length;
  const previousReservationsCreated = previousReservations.length;
  const salesSeries = computeSalesSeries(
    sales,
    dateRange.startIso,
    dateRange.endIsoExclusive,
    dateRange.dayCount
  );

  const maxSeries = Math.max(...salesSeries.map((point) => point.value), 1);
  const byProduct = new Map<
    string,
    { units: number; revenue: number; name: string; image: string }
  >();

  for (const sale of sales) {
    const catalogItem = Array.isArray(sale.catalog_items)
      ? sale.catalog_items[0]
      : sale.catalog_items;
    if (!catalogItem) {
      continue;
    }

    const category = mapCategory(catalogItem.item_type);
    const current = byProduct.get(sale.catalog_item_id) ?? {
      units: 0,
      revenue: 0,
      name: catalogItem.name,
      image: pickImage(catalogItem.product_images, category),
    };
    current.units += 1;
    current.revenue += sale.sale_price_cents / 100;
    byProduct.set(sale.catalog_item_id, current);
  }

  const topModels = Array.from(byProduct.entries())
    .map(([productId, metrics]) => ({
      productId,
      name: metrics.name,
      image: metrics.image,
      units: metrics.units,
      revenue: Math.round(metrics.revenue),
      trend: Math.min(100, Math.max(20, Math.round((metrics.revenue / maxSeries) * 100))),
    }))
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
    .slice(0, 4);

  const totalReservations = reservations.length;
  const activeCount = reservations.filter((item) => item.status === "active").length;
  const completedCount = reservations.filter((item) => item.status === "completed").length;
  const cancelledCount = reservations.filter((item) => item.status === "cancelled").length;
  const expiredCount = reservations.filter((item) => item.status === "expired").length;

  return {
    dateRange,
    previousDateRange,
    revenue: Math.round(revenue),
    unitsSold,
    avgOrderValue,
    reservationsCreated: totalReservations,
    comparison: {
      revenue: comparisonMetric(Math.round(revenue), Math.round(previousRevenue)),
      unitsSold: comparisonMetric(unitsSold, previousUnitsSold),
      reservationsCreated: comparisonMetric(totalReservations, previousReservationsCreated),
    },
    salesSeries,
    topModels,
    reservation: {
      totalCount: totalReservations,
      activeCount,
      completedCount,
      cancelledCount,
      expiredCount,
      conversionRate: totalReservations > 0 ? Math.round((completedCount / totalReservations) * 100) : 0,
      cancellationRate: totalReservations > 0 ? Math.round((cancelledCount / totalReservations) * 100) : 0,
      expiryRate: totalReservations > 0 ? Math.round((expiredCount / totalReservations) * 100) : 0,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const role = await getRequestStaffRole(request);
    if (role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can view reports." },
        { status: 403 }
      );
    }

    const nowIso = request.nextUrl.searchParams.get("nowIso");
    const now = nowIso && !Number.isNaN(new Date(nowIso).getTime()) ? new Date(nowIso) : new Date();
    const startDate = request.nextUrl.searchParams.get("startDate") ?? undefined;
    const endDate = request.nextUrl.searchParams.get("endDate") ?? undefined;
    const dateRange = resolveReportDateRange({ startDate, endDate }, now);
    const previousDateRange = buildPreviousReportDateRange(dateRange, now);
    const supabase = getServerSupabaseAdminClient();
    const [{ data: salesRows, error: salesError }, { data: reservationsRows, error: reservationsError }] =
      await Promise.all([
        supabase
          .from("sales")
          .select(
            "id,catalog_item_id,sale_price_cents,sold_at,catalog_items(id,name,item_type,product_images(bucket_name,object_path,external_url,is_primary,sort_order))"
          )
          .gte("sold_at", previousDateRange.startIso)
          .lt("sold_at", dateRange.endIsoExclusive)
          .order("sold_at", { ascending: false }),
        supabase
          .from("reservations")
          .select("status,reserved_for_at")
          .gte("reserved_for_at", previousDateRange.startIso)
          .lt("reserved_for_at", dateRange.endIsoExclusive),
      ]);

    if (salesError) {
      return NextResponse.json(
        { error: "Failed to load sales for report.", details: salesError },
        { status: 500 }
      );
    }
    if (reservationsError) {
      return NextResponse.json(
        { error: "Failed to load reservations for report.", details: reservationsError },
        { status: 500 }
      );
    }

    const allSales = (salesRows ?? []) as SaleRow[];
    const currentSales = allSales.filter((sale) => sale.sold_at >= dateRange.startIso);
    const previousSales = allSales.filter(
      (sale) =>
        sale.sold_at >= previousDateRange.startIso && sale.sold_at < dateRange.startIso
    );
    const allReservations = (reservationsRows ?? []) as ReservationRow[];
    const currentReservations = allReservations.filter(
      (reservation) => reservation.reserved_for_at >= dateRange.startIso
    );
    const previousReservations = allReservations.filter(
      (reservation) =>
        reservation.reserved_for_at >= previousDateRange.startIso &&
        reservation.reserved_for_at < dateRange.startIso
    );

    return NextResponse.json({
      data: buildOperationalReport(
        currentSales,
        previousSales,
        currentReservations,
        previousReservations,
        now,
        { startDate, endDate }
      ),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected reports error.";
    const status = message.includes("date") || message.includes("Date") ? 400 : 500;
    return NextResponse.json(
      {
        error: status === 400 ? message : "Unexpected reports error.",
        details: status === 500 && error instanceof Error ? { message: error.message } : null,
      },
      { status }
    );
  }
}
