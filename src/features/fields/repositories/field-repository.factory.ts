import { createMockFieldRepository } from "@/features/fields/adapters/mock/field-repository.mock";
import { createSupabaseFieldRepository } from "@/features/fields/adapters/supabase/field-repository.supabase";
import type { FieldRepository } from "@/features/fields/repositories/field-repository";
import { getFieldDataSource, type CatalogDataSource } from "@/lib/feature-flags";
import { hasSupabasePublicEnv } from "@/lib/supabase/client";

let cachedRepository: FieldRepository | null = null;
let cachedSource: CatalogDataSource | null = null;

export function getFieldRepository(): FieldRepository {
  const source = getFieldDataSource();
  if (cachedRepository && cachedSource === source) {
    return cachedRepository;
  }

  if (source === "supabase" && hasSupabasePublicEnv()) {
    cachedRepository = createSupabaseFieldRepository();
    cachedSource = source;
    return cachedRepository;
  }

  if (source === "supabase" && !hasSupabasePublicEnv() && typeof window !== "undefined") {
    console.warn(
      "Supabase field adapter selected but NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY are missing. Falling back to mock adapter."
    );
  }

  cachedRepository = createMockFieldRepository();
  cachedSource = source;
  return cachedRepository;
}
