"use client";

import { useMemo, useState } from "react";
import { getFieldRepository, useFieldData } from "@/features/fields";
import type { FieldDTO, FieldDataType } from "@/features/fields";
import {
  buildFieldLayoutItems,
  coreFieldOptions,
  loadFieldLayoutConfig,
  saveFieldLayoutConfig,
  setCategoryFieldOrder,
  setCoreFieldLabel,
  setCoreFieldOptions,
  setCorePublicVisibility,
  type CoreFieldKey,
  type FieldLayoutItem,
} from "@/features/fields/field-layout";
import type {
  Category,
  CoreFieldEditor,
  VisibilityFilter,
} from "@/features/fields/admin/field-settings-types";
import {
  CATEGORY_OPTION_VALUES_FOR_FIELDS,
  canEditCoreOptions,
  normalizeCoreOptionLabels,
  normalizeOptionLabels,
  parseActionError,
} from "@/features/fields/admin/field-settings-helpers";
import { publishInvalidation } from "@/features/shared/freshness/invalidation";
import { CRITICAL_INVALIDATION_TAGS } from "@/features/shared/freshness/critical-field-registry";
import { getFieldDataSource } from "@/lib/feature-flags";
import { hasSupabasePublicEnv } from "@/lib/supabase/client";

export type FieldSettingsTranslator = (
  key: string,
  params?: Record<string, string | number>
) => string;

export function useFieldSettingsController(t: FieldSettingsTranslator) {
  const [activeTab, setActiveTab] = useState<Category>('Bicycle');
  const [showModal, setShowModal] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldNameRu, setNewFieldNameRu] = useState('');
  const [newFieldNameKa, setNewFieldNameKa] = useState('');
  const [newFieldDataType, setNewFieldDataType] = useState<FieldDataType>('text');
  const [isPublic, setIsPublic] = useState(true);
  const [newFieldOptionsEnabled, setNewFieldOptionsEnabled] = useState(false);
  const [newFieldOptionDrafts, setNewFieldOptionDrafts] = useState<string[]>(['']);
  const [query, setQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const [workingFieldId, setWorkingFieldId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const [dragOverFieldId, setDragOverFieldId] = useState<string | null>(null);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [optionsField, setOptionsField] = useState<FieldDTO | null>(null);
  const [optionsFieldName, setOptionsFieldName] = useState('');
  const [optionsFieldNameRu, setOptionsFieldNameRu] = useState('');
  const [optionsFieldNameKa, setOptionsFieldNameKa] = useState('');
  const [optionsFieldDataType, setOptionsFieldDataType] = useState<FieldDataType>('text');
  const [optionsFieldIsPublic, setOptionsFieldIsPublic] = useState(true);
  const [optionsEnabled, setOptionsEnabled] = useState(false);
  const [optionDrafts, setOptionDrafts] = useState<string[]>([]);
  const [coreFieldEditor, setCoreFieldEditor] = useState<CoreFieldEditor | null>(null);
  const [coreFieldName, setCoreFieldName] = useState('');
  const [coreOptionDrafts, setCoreOptionDrafts] = useState<string[]>([]);
  const [coreFieldIsPublic, setCoreFieldIsPublic] = useState(true);
  const { fields, isLoading, error, reload } = useFieldData('all');
  const fieldRepository = useMemo(() => getFieldRepository(), []);
  const dataSource = getFieldDataSource();
  const hasSupabaseEnv = hasSupabasePublicEnv();
  const isSupabaseRequested = dataSource === 'supabase';
  const isUsingFallbackMock = isSupabaseRequested && !hasSupabaseEnv;
  const isMockRequested = dataSource === 'mock';

  const fieldLayoutConfig = useMemo(() => loadFieldLayoutConfig(), [layoutVersion]);

  const orderedLayoutItems = useMemo(
    () => buildFieldLayoutItems(activeTab, fields, fieldLayoutConfig),
    [activeTab, fieldLayoutConfig, fields]
  );

  const visibleLayoutItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return orderedLayoutItems
      .filter((item) => {
        if (visibilityFilter === 'public') {
          return item.isPublic;
        }
        if (visibilityFilter === 'internal') {
          return !item.isPublic;
        }
        return true;
      })
      .filter((item) => {
        if (!normalizedQuery) {
          return true;
        }
        const searchable =
          item.kind === 'core'
            ? [item.core.name, item.core.key, item.core.dataType]
            : [
                item.field.name,
                item.field.nameTranslations?.en ?? '',
                item.field.nameTranslations?.ru ?? '',
                item.field.nameTranslations?.ka ?? '',
                item.field.fieldKey,
                item.field.dataType,
                item.field.inputMode,
                ...item.field.options.map((option) => option.label),
              ];
        return searchable
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      });
  }, [orderedLayoutItems, query, visibilityFilter]);

  const canReorderFields = workingFieldId !== 'reordering';

  const createField = async () => {
    if (!newFieldName.trim()) {
      return;
    }
    const options = newFieldOptionsEnabled ? normalizeOptionLabels(newFieldOptionDrafts) : [];
    if (newFieldOptionsEnabled && options.length === 0) {
      setActionError(t('fields.optionRequired'));
      return;
    }
    setWorkingFieldId('creating');
    setActionError(null);
    try {
      await fieldRepository.createField({
        name: newFieldName,
        nameTranslations: {
          en: newFieldName,
          ru: newFieldNameRu,
          ka: newFieldNameKa,
        },
        category: activeTab,
        isPublic,
        dataType: newFieldDataType,
        inputMode: options.length > 0 ? 'single_select' : 'free_text',
        options,
      });
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.REPORTS_KPI);
      await reload();
      setNewFieldName('');
      setNewFieldNameRu('');
      setNewFieldNameKa('');
      setNewFieldDataType('text');
      setIsPublic(true);
      setNewFieldOptionsEnabled(false);
      setNewFieldOptionDrafts(['']);
      setShowModal(false);
    } catch (caughtError) {
      setActionError(parseActionError(caughtError));
    } finally {
      setWorkingFieldId(null);
    }
  };

  const toggleFieldVisibility = async (field: FieldDTO) => {
    setWorkingFieldId(field.id);
    setActionError(null);
    try {
      await fieldRepository.updateField(field.id, { isPublic: !field.isPublic });
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.REPORTS_KPI);
      await reload();
    } catch (caughtError) {
      setActionError(parseActionError(caughtError));
    } finally {
      setWorkingFieldId(null);
    }
  };

  const toggleCoreVisibility = (fieldKey: CoreFieldKey, isPublic: boolean) => {
    const nextConfig = setCorePublicVisibility(fieldLayoutConfig, activeTab, fieldKey, !isPublic);
    saveFieldLayoutConfig(nextConfig);
    setLayoutVersion((current) => current + 1);
    publishInvalidation(CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL);
    publishInvalidation(CRITICAL_INVALIDATION_TAGS.REPORTS_KPI);
  };

  const archiveField = async (fieldId: string) => {
    setWorkingFieldId(fieldId);
    setActionError(null);
    try {
      await fieldRepository.archiveField(fieldId);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.REPORTS_KPI);
      await reload();
    } catch (caughtError) {
      setActionError(parseActionError(caughtError));
    } finally {
      setWorkingFieldId(null);
    }
  };

  const openOptionsEditor = (field: FieldDTO) => {
    setOptionsField(field);
    setOptionsFieldName(field.nameTranslations?.en ?? field.name);
    setOptionsFieldNameRu(field.nameTranslations?.ru ?? '');
    setOptionsFieldNameKa(field.nameTranslations?.ka ?? '');
    setOptionsFieldDataType(field.dataType);
    setOptionsFieldIsPublic(field.isPublic);
    setOptionsEnabled(field.inputMode === 'single_select');
    setOptionDrafts(field.options.length > 0 ? field.options.map((option) => option.label) : ['']);
    setActionError(null);
  };

  const closeOptionsEditor = () => {
    setOptionsField(null);
    setOptionsFieldName('');
    setOptionsFieldNameRu('');
    setOptionsFieldNameKa('');
    setOptionsFieldDataType('text');
    setOptionsFieldIsPublic(true);
    setOptionsEnabled(false);
    setOptionDrafts([]);
  };

  const saveOptions = async () => {
    if (!optionsField) {
      return;
    }

    const fieldName = optionsFieldName.trim();
    if (!fieldName) {
      setActionError(t('fields.nameRequired'));
      return;
    }

    const options = optionsEnabled ? normalizeOptionLabels(optionDrafts) : [];
    if (optionsEnabled && options.length === 0) {
      setActionError(t('fields.optionRequired'));
      return;
    }

    setWorkingFieldId(optionsField.id);
    setActionError(null);
    try {
      await fieldRepository.updateField(optionsField.id, {
        name: fieldName,
        nameTranslations: {
          en: fieldName,
          ru: optionsFieldNameRu,
          ka: optionsFieldNameKa,
        },
        dataType: optionsFieldDataType,
        isPublic: optionsFieldIsPublic,
        inputMode: options.length > 0 ? 'single_select' : 'free_text',
        options,
      });
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.REPORTS_KPI);
      await reload();
      closeOptionsEditor();
    } catch (caughtError) {
      setActionError(parseActionError(caughtError));
    } finally {
      setWorkingFieldId(null);
    }
  };

  const updateOptionDraft = (index: number, value: string) => {
    setOptionDrafts((current) => current.map((option, optionIndex) => (optionIndex === index ? value : option)));
  };

  const removeOptionDraft = (index: number) => {
    setOptionDrafts((current) => current.filter((_, optionIndex) => optionIndex !== index));
  };

  const moveOptionDraft = (index: number, direction: -1 | 1) => {
    setOptionDrafts((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
  };

  const openCoreEditor = (item: Extract<FieldLayoutItem, { kind: 'core' }>) => {
    const existingOptions = coreFieldOptions(fieldLayoutConfig, item.core.key);
    setCoreFieldEditor({
      category: activeTab,
      field: item.core,
      isPublic: item.isPublic,
    });
    setCoreFieldName(item.core.name);
    setCoreFieldIsPublic(item.isPublic);
    if (item.core.key === 'category') {
      setCoreOptionDrafts(
        CATEGORY_OPTION_VALUES_FOR_FIELDS.map(
          (value) => existingOptions.find((option) => option.value === value)?.label ?? value
        )
      );
    } else if (canEditCoreOptions(item.core.key)) {
      setCoreOptionDrafts(existingOptions.length > 0 ? existingOptions.map((option) => option.label) : ['']);
    } else {
      setCoreOptionDrafts([]);
    }
    setActionError(null);
  };

  const closeCoreEditor = () => {
    setCoreFieldEditor(null);
    setCoreFieldName('');
    setCoreOptionDrafts([]);
    setCoreFieldIsPublic(true);
  };

  const saveCoreEditor = () => {
    if (!coreFieldEditor) {
      return;
    }

    const name = coreFieldName.trim();
    if (!name) {
      setActionError('Field name cannot be empty.');
      return;
    }

    const nextOptions = canEditCoreOptions(coreFieldEditor.field.key)
      ? normalizeCoreOptionLabels(coreFieldEditor.field.key, coreOptionDrafts)
      : [];

    if (coreFieldEditor.field.key === 'drive_type' && nextOptions.length === 0) {
      setActionError('Drive Type needs at least one option.');
      return;
    }

    let nextConfig = setCoreFieldLabel(
      fieldLayoutConfig,
      coreFieldEditor.category,
      coreFieldEditor.field.key,
      name
    );
    nextConfig = setCorePublicVisibility(
      nextConfig,
      coreFieldEditor.category,
      coreFieldEditor.field.key,
      coreFieldIsPublic
    );
    if (canEditCoreOptions(coreFieldEditor.field.key)) {
      nextConfig = setCoreFieldOptions(nextConfig, coreFieldEditor.field.key, nextOptions);
    }

    saveFieldLayoutConfig(nextConfig);
    setLayoutVersion((current) => current + 1);
    publishInvalidation(CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL);
    publishInvalidation(CRITICAL_INVALIDATION_TAGS.REPORTS_KPI);
    closeCoreEditor();
  };

  const updateCoreOptionDraft = (index: number, value: string) => {
    setCoreOptionDrafts((current) =>
      current.map((option, optionIndex) => (optionIndex === index ? value : option))
    );
  };

  const removeCoreOptionDraft = (index: number) => {
    setCoreOptionDrafts((current) => current.filter((_, optionIndex) => optionIndex !== index));
  };

  const updateNewFieldOptionDraft = (index: number, value: string) => {
    setNewFieldOptionDrafts((current) =>
      current.map((option, optionIndex) => (optionIndex === index ? value : option))
    );
  };

  const removeNewFieldOptionDraft = (index: number) => {
    setNewFieldOptionDrafts((current) => current.filter((_, optionIndex) => optionIndex !== index));
  };

  const reorderField = async (draggedId: string | null, targetId: string) => {
    setDraggingFieldId(null);
    setDragOverFieldId(null);
    if (!draggedId || draggedId === targetId || !canReorderFields) {
      return;
    }

    const fromIndex = orderedLayoutItems.findIndex((item) => item.id === draggedId);
    const toIndex = orderedLayoutItems.findIndex((item) => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0) {
      return;
    }

    const nextOrder = [...orderedLayoutItems];
    const [moved] = nextOrder.splice(fromIndex, 1);
    nextOrder.splice(toIndex, 0, moved);
    const nextConfig = setCategoryFieldOrder(
      fieldLayoutConfig,
      activeTab,
      nextOrder.map((item) => item.id)
    );
    saveFieldLayoutConfig(nextConfig);
    setLayoutVersion((current) => current + 1);

    setWorkingFieldId('reordering');
    setActionError(null);
    try {
      const customFieldsInOrder = nextOrder.filter(
        (item): item is Extract<FieldLayoutItem, { kind: 'custom' }> => item.kind === 'custom'
      );
      await Promise.all(
        customFieldsInOrder.map((item, index) =>
          item.field.sortOrder === index + 1
            ? Promise.resolve(item.field)
            : fieldRepository.updateField(item.field.id, { sortOrder: index + 1 })
        )
      );
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.CATALOG_CRITICAL);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.REPORTS_KPI);
      await reload();
    } catch (caughtError) {
      setActionError(parseActionError(caughtError));
    } finally {
      setWorkingFieldId(null);
    }
  };

  return {
    activeTab,
    setActiveTab,
    showModal,
    setShowModal,
    newFieldName,
    setNewFieldName,
    newFieldNameRu,
    setNewFieldNameRu,
    newFieldNameKa,
    setNewFieldNameKa,
    newFieldDataType,
    setNewFieldDataType,
    isPublic,
    setIsPublic,
    newFieldOptionsEnabled,
    setNewFieldOptionsEnabled,
    newFieldOptionDrafts,
    setNewFieldOptionDrafts,
    query,
    setQuery,
    visibilityFilter,
    setVisibilityFilter,
    workingFieldId,
    actionError,
    draggingFieldId,
    setDraggingFieldId,
    dragOverFieldId,
    setDragOverFieldId,
    optionsField,
    optionsFieldName,
    setOptionsFieldName,
    optionsFieldNameRu,
    setOptionsFieldNameRu,
    optionsFieldNameKa,
    setOptionsFieldNameKa,
    optionsFieldDataType,
    setOptionsFieldDataType,
    optionsFieldIsPublic,
    setOptionsFieldIsPublic,
    optionsEnabled,
    setOptionsEnabled,
    optionDrafts,
    setOptionDrafts,
    coreFieldEditor,
    coreFieldName,
    setCoreFieldName,
    coreOptionDrafts,
    setCoreOptionDrafts,
    coreFieldIsPublic,
    setCoreFieldIsPublic,
    isLoading,
    error,
    isUsingFallbackMock,
    isMockRequested,
    fieldLayoutConfig,
    visibleLayoutItems,
    canReorderFields,
    createField,
    toggleFieldVisibility,
    toggleCoreVisibility,
    archiveField,
    openOptionsEditor,
    closeOptionsEditor,
    saveOptions,
    updateOptionDraft,
    removeOptionDraft,
    moveOptionDraft,
    openCoreEditor,
    closeCoreEditor,
    saveCoreEditor,
    updateCoreOptionDraft,
    removeCoreOptionDraft,
    updateNewFieldOptionDraft,
    removeNewFieldOptionDraft,
    reorderField,
  };
}
