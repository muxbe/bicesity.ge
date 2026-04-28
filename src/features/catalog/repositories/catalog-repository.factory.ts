import { createMockCatalogRepository } from "@/features/catalog/adapters/mock/catalog-repository.mock";
import { createSupabaseCatalogRepository } from "@/features/catalog/adapters/supabase/catalog-repository.supabase";
import type { CatalogRepository } from "@/features/catalog/repositories/catalog-repository";
import { getCatalogDataSource, type CatalogDataSource } from "@/lib/feature-flags";
import { hasSupabasePublicEnv } from "@/lib/supabase/client";

let cachedRepository: CatalogRepository | null = null;
let cachedSource: CatalogDataSource | null = null;

function createRepositoryForSource(source: CatalogDataSource): CatalogRepository {
  if (source === "supabase") {
    if (!hasSupabasePublicEnv()) {
      if (typeof window !== "undefined") {
        console.warn(
          "Supabase catalog adapter selected but NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY are missing. Falling back to mock adapter."
        );
      }
      return createMockCatalogRepository();
    }
    return createSupabaseCatalogRepository();
  }
  return createMockCatalogRepository();
}

export function getCatalogRepository(): CatalogRepository {
  const source = getCatalogDataSource();
  if (cachedRepository && cachedSource === source) {
    return cachedRepository;
  }

  cachedRepository = createRepositoryForSource(source);
  cachedSource = source;
  return cachedRepository;
}

