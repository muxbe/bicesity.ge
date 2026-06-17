'use client';

import { useMemo, useState } from 'react';
import { getFieldRepository, useFieldData } from '@/features/fields';
import type { FieldDTO, FieldDataType } from '@/features/fields';
import {
  buildFieldLayoutItems,
  coreFieldOptions,
  loadFieldLayoutConfig,
  saveFieldLayoutConfig,
  setCoreFieldLabel,
  setCoreFieldOptions,
  setCategoryFieldOrder,
  setCorePublicVisibility,
  type CoreFieldKey,
  type FieldLayoutItem,
} from '@/features/fields/field-layout';
import type {
  Category,
  CoreFieldEditor,
  VisibilityFilter,
} from '@/features/fields/admin/field-settings-types';
import {
  CATEGORY_OPTION_VALUES_FOR_FIELDS,
  canEditCoreOptions,
  normalizeCoreOptionLabels,
  normalizeOptionLabels,
  parseActionError,
} from '@/features/fields/admin/field-settings-helpers';
import { AddFieldModal } from '@/features/fields/admin/add-field-modal';
import { FieldCardGrid } from '@/features/fields/admin/field-card-grid';
import { FieldSettingsToolbar } from '@/features/fields/admin/field-settings-toolbar';
import { EditCoreFieldModal } from '@/features/fields/admin/edit-core-field-modal';
import { EditCustomFieldModal } from '@/features/fields/admin/edit-custom-field-modal';
import { publishInvalidation } from '@/features/shared/freshness/invalidation';
import { CRITICAL_INVALIDATION_TAGS } from '@/features/shared/freshness/critical-field-registry';
import { getFieldDataSource } from '@/lib/feature-flags';
import { hasSupabasePublicEnv } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n';

export default function FieldSettingsPage() {
  const { locale, t } = useI18n();
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

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-8 sm:mb-10">
        <h1 className="text-3xl font-black text-slate-900 sm:text-4xl">{t('fields.title')}</h1>
        <p className="text-sm text-slate-500 mt-2">
          {t('fields.description')}
        </p>
        {(error || actionError) && <p className="text-sm text-rose-600 mt-2">{actionError ?? error}</p>}
        {isUsingFallbackMock && (
          <p className="text-sm text-amber-700 mt-2">
            {t('fields.fallbackWarning')}
          </p>
        )}
        {isMockRequested && (
          <p className="text-sm text-amber-700 mt-2">
            {t('fields.mockWarning')}
          </p>
        )}
        <p className="text-sm text-slate-500 mt-2">
          {t('fields.help')}
        </p>
      </div>

      <div className="mb-8 flex gap-5 overflow-x-auto border-b border-slate-200 sm:mb-10 sm:gap-8">
        {(['Bicycle', 'Parts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-4 px-1 font-semibold transition-colors relative ${
              activeTab === tab ? 'text-[var(--brand-cyan-dark)]' : 'text-slate-600 hover:text-slate-900'
            }`}
            style={{ borderBottomWidth: activeTab === tab ? '3px' : '0px' }}
          >
            {tab === 'Bicycle' ? t('fields.bicycleFields') : t('fields.partsFields')}
          </button>
        ))}
      </div>

      <FieldSettingsToolbar
        query={query}
        visibilityFilter={visibilityFilter}
        visibleCount={visibleLayoutItems.length}
        t={t}
        onQueryChange={setQuery}
        onVisibilityFilterChange={setVisibilityFilter}
      />
      {workingFieldId === 'reordering' && (
        <p className="mb-4 text-xs font-semibold text-amber-700">
          {t('fields.savingOrder')}
        </p>
      )}

      <FieldCardGrid
        isLoading={isLoading}
        visibleLayoutItems={visibleLayoutItems}
        locale={locale}
        workingFieldId={workingFieldId}
        draggingFieldId={draggingFieldId}
        dragOverFieldId={dragOverFieldId}
        canReorderFields={canReorderFields}
        fieldLayoutConfig={fieldLayoutConfig}
        t={t}
        onAddField={() => setShowModal(true)}
        onToggleCoreVisibility={(fieldKey, isPublicValue) => {
          void toggleCoreVisibility(fieldKey, isPublicValue);
        }}
        onToggleFieldVisibility={(field) => {
          void toggleFieldVisibility(field);
        }}
        onOpenCoreEditor={openCoreEditor}
        onOpenOptionsEditor={openOptionsEditor}
        onArchiveField={(fieldId) => {
          void archiveField(fieldId);
        }}
        onDragStart={setDraggingFieldId}
        onDragOver={setDragOverFieldId}
        onDragLeave={() => setDragOverFieldId(null)}
        onDrop={(targetId, dataTransferId) => {
          void reorderField(draggingFieldId ?? dataTransferId, targetId);
        }}
        onDragEnd={() => {
          setDraggingFieldId(null);
          setDragOverFieldId(null);
        }}
      />
      <AddFieldModal
        isOpen={showModal}
        fieldName={newFieldName}
        fieldNameRu={newFieldNameRu}
        fieldNameKa={newFieldNameKa}
        dataType={newFieldDataType}
        isPublic={isPublic}
        optionsEnabled={newFieldOptionsEnabled}
        optionDrafts={newFieldOptionDrafts}
        isCreating={workingFieldId === 'creating'}
        t={t}
        onFieldNameChange={setNewFieldName}
        onFieldNameRuChange={setNewFieldNameRu}
        onFieldNameKaChange={setNewFieldNameKa}
        onDataTypeChange={setNewFieldDataType}
        onPublicChange={setIsPublic}
        onOptionsEnabledChange={(value) => {
          setNewFieldOptionsEnabled(value);
          if (value && newFieldOptionDrafts.length === 0) {
            setNewFieldOptionDrafts(['']);
          }
        }}
        onOptionDraftChange={updateNewFieldOptionDraft}
        onOptionDraftRemove={removeNewFieldOptionDraft}
        onOptionDraftAdd={() => setNewFieldOptionDrafts((current) => [...current, ''])}
        onSubmit={() => void createField()}
        onClose={() => setShowModal(false)}
      />
      <EditCoreFieldModal
        editor={coreFieldEditor}
        fieldName={coreFieldName}
        isPublic={coreFieldIsPublic}
        optionDrafts={coreOptionDrafts}
        t={t}
        onFieldNameChange={setCoreFieldName}
        onPublicChange={setCoreFieldIsPublic}
        onOptionDraftChange={updateCoreOptionDraft}
        onOptionDraftRemove={removeCoreOptionDraft}
        onOptionDraftAdd={() => setCoreOptionDrafts((current) => [...current, ''])}
        onSave={saveCoreEditor}
        onClose={closeCoreEditor}
      />
      <EditCustomFieldModal
        field={optionsField}
        fieldName={optionsFieldName}
        fieldNameRu={optionsFieldNameRu}
        fieldNameKa={optionsFieldNameKa}
        dataType={optionsFieldDataType}
        isPublic={optionsFieldIsPublic}
        optionsEnabled={optionsEnabled}
        optionDrafts={optionDrafts}
        isSaving={optionsField ? workingFieldId === optionsField.id : false}
        t={t}
        onFieldNameChange={setOptionsFieldName}
        onFieldNameRuChange={setOptionsFieldNameRu}
        onFieldNameKaChange={setOptionsFieldNameKa}
        onDataTypeChange={setOptionsFieldDataType}
        onPublicChange={setOptionsFieldIsPublic}
        onOptionsEnabledChange={(value) => {
          setOptionsEnabled(value);
          if (value && optionDrafts.length === 0) {
            setOptionDrafts(['']);
          }
        }}
        onOptionDraftChange={updateOptionDraft}
        onOptionDraftRemove={removeOptionDraft}
        onOptionDraftMove={moveOptionDraft}
        onOptionDraftAdd={() => setOptionDrafts((current) => [...current, ''])}
        onSave={() => void saveOptions()}
        onClose={closeOptionsEditor}
      />
    </div>
  );
}
