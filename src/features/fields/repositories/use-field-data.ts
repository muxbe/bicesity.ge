"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FieldDTO } from "@/features/fields/dto/field-dto";
import { getFieldRepository } from "@/features/fields/repositories/field-repository.factory";

type FieldDataState = {
  fields: FieldDTO[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function useFieldData(category: "Bicycle" | "Parts" | "all" = "all"): FieldDataState {
  const repository = useMemo(() => getFieldRepository(), []);
  const [fields, setFields] = useState<FieldDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await repository.listFields(category);
      setFields(data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load fields.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [repository, category]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    fields,
    isLoading,
    error,
    reload: load,
  };
}

