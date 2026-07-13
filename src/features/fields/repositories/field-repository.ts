import type {
  CreateFieldDTO,
  FieldDTO,
  UpdateFieldDTO,
} from "@/features/fields/dto/field-dto";
import type {
  FieldLayoutConfig,
  FieldLayoutState,
} from "@/features/fields/field-layout";

export interface FieldRepository {
  listFields(category?: "Bicycle" | "Parts" | "all"): Promise<FieldDTO[]>;
  createField(input: CreateFieldDTO): Promise<FieldDTO>;
  updateField(fieldId: string, input: UpdateFieldDTO): Promise<FieldDTO>;
  archiveField(fieldId: string): Promise<void>;
  getFieldLayout(): Promise<FieldLayoutState>;
  updateFieldLayout(config: FieldLayoutConfig): Promise<FieldLayoutState>;
}
