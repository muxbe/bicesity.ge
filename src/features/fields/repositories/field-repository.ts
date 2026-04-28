import type {
  CreateFieldDTO,
  FieldDTO,
  UpdateFieldDTO,
} from "@/features/fields/dto/field-dto";

export interface FieldRepository {
  listFields(category?: "Bicycle" | "Parts" | "all"): Promise<FieldDTO[]>;
  createField(input: CreateFieldDTO): Promise<FieldDTO>;
  updateField(fieldId: string, input: UpdateFieldDTO): Promise<FieldDTO>;
  archiveField(fieldId: string): Promise<void>;
}

