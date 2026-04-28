import { createMockReportRepository } from "@/features/reports/adapters/mock/report-repository.mock";
import { createSupabaseReportRepository } from "@/features/reports/adapters/supabase/report-repository.supabase";
import type { ReportRepository } from "@/features/reports/repositories/report-repository";
import { getReportDataSource, type CatalogDataSource } from "@/lib/feature-flags";
import { hasSupabasePublicEnv } from "@/lib/supabase/client";

let cachedRepository: ReportRepository | null = null;
let cachedSource: CatalogDataSource | null = null;

export function getReportRepository(): ReportRepository {
  const source = getReportDataSource();
  if (cachedRepository && cachedSource === source) {
    return cachedRepository;
  }

  if (source === "supabase" && hasSupabasePublicEnv()) {
    cachedRepository = createSupabaseReportRepository();
    cachedSource = source;
    return cachedRepository;
  }

  if (source === "supabase" && !hasSupabasePublicEnv() && typeof window !== "undefined") {
    console.warn(
      "Supabase report adapter selected but NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY are missing. Falling back to mock adapter."
    );
  }

  cachedRepository = createMockReportRepository();
  cachedSource = source;
  return cachedRepository;
}
