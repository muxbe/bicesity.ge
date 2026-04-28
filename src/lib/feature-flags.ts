export type CatalogDataSource = "mock" | "supabase";

function readEnvValue(rawValue: string | undefined): string {
  return (rawValue ?? "").trim().toLowerCase();
}

function readDataSource(value: string): CatalogDataSource | null {
  if (value === "supabase" || value === "mock") {
    return value;
  }
  return null;
}

function resolveDataSource(preferredEnv: string | undefined): CatalogDataSource {
  const preferred = readDataSource(readEnvValue(preferredEnv));
  if (preferred) {
    return preferred;
  }

  const globalDefault = readDataSource(readEnvValue(process.env.NEXT_PUBLIC_DATA_SOURCE));
  if (globalDefault) {
    return globalDefault;
  }

  return "mock";
}

export function getCatalogDataSource(): CatalogDataSource {
  return resolveDataSource(process.env.NEXT_PUBLIC_CATALOG_DATA_SOURCE);
}

export function getReservationDataSource(): CatalogDataSource {
  return resolveDataSource(process.env.NEXT_PUBLIC_RESERVATION_DATA_SOURCE);
}

export function getFieldDataSource(): CatalogDataSource {
  return resolveDataSource(process.env.NEXT_PUBLIC_FIELD_DATA_SOURCE);
}

export function getReportDataSource(): CatalogDataSource {
  return resolveDataSource(process.env.NEXT_PUBLIC_REPORT_DATA_SOURCE);
}

export function isSupabaseCatalogEnabled(): boolean {
  return getCatalogDataSource() === "supabase";
}
