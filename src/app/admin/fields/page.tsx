'use client';

import { useMemo, useState } from 'react';
import { Eye, EyeOff, GripVertical, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
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
import { FieldOptionDrafts } from '@/features/fields/admin/field-option-drafts';
import { publishInvalidation } from '@/features/shared/freshness/invalidation';
import { CRITICAL_INVALIDATION_TAGS } from '@/features/shared/freshness/critical-field-registry';
import { getFieldDataSource } from '@/lib/feature-flags';
import { hasSupabasePublicEnv } from '@/lib/supabase/client';
import { fieldNameLabel, useI18n } from '@/lib/i18n';

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

      <div className="mb-6 grid grid-cols-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 md:grid-cols-[1fr,220px,auto]">
        <div className="relative">
          <Search size={16} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('fields.searchPlaceholder')}
            className="brand-control h-11 w-full rounded-xl border pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={visibilityFilter}
          onChange={(event) => setVisibilityFilter(event.target.value as VisibilityFilter)}
          className="brand-control h-11 rounded-xl border px-3 text-sm"
        >
          <option value="all">{t('fields.allVisibility')}</option>
          <option value="public">{t('fields.publicOnly')}</option>
          <option value="internal">{t('fields.internalOnly')}</option>
        </select>
        <p className="text-xs text-slate-500 font-semibold">
          {t('fields.count', {
            count: visibleLayoutItems.length,
            plural: visibleLayoutItems.length === 1 ? '' : 's',
          })}
        </p>
      </div>
      {workingFieldId === 'reordering' && (
        <p className="mb-4 text-xs font-semibold text-amber-700">
          {t('fields.savingOrder')}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {!isLoading && visibleLayoutItems.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            {t('fields.noMatch')}
          </div>
        )}
        {visibleLayoutItems.map((item, index) => {
          const isCore = item.kind === 'core';
          const fieldName = isCore ? item.core.name : fieldNameLabel(item.field, locale);
          const dataType = isCore ? item.core.dataType : item.field.dataType;
          const fieldKey = isCore ? item.core.key : item.field.fieldKey;
          const isWorking =
            workingFieldId === 'reordering' ||
            (!isCore && workingFieldId === item.field.id);

          return (
          <div
            key={item.id}
            draggable={canReorderFields}
            onDragStart={(event) => {
              if (!canReorderFields) {
                return;
              }
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', item.id);
              setDraggingFieldId(item.id);
            }}
            onDragOver={(event) => {
              if (!canReorderFields || !draggingFieldId || draggingFieldId === item.id) {
                return;
              }
              event.preventDefault();
              setDragOverFieldId(item.id);
            }}
            onDragLeave={() => {
              if (dragOverFieldId === item.id) {
                setDragOverFieldId(null);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              void reorderField(draggingFieldId ?? event.dataTransfer.getData('text/plain'), item.id);
            }}
            onDragEnd={() => {
              setDraggingFieldId(null);
              setDragOverFieldId(null);
            }}
            className={`rounded-2xl border bg-white p-4 transition-colors sm:rounded-[2rem] sm:p-6 ${
              dragOverFieldId === item.id
                ? 'border-cyan-500 ring-2 ring-cyan-100'
                : 'border-slate-200 hover:border-slate-300'
            } ${canReorderFields ? 'cursor-grab active:cursor-grabbing' : ''} ${
              draggingFieldId === item.id ? 'opacity-60' : ''
            }`}
          >
            <div className="mb-4 flex justify-between items-start">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    isCore
                      ? toggleCoreVisibility(item.core.key, item.isPublic)
                      : toggleFieldVisibility(item.field)
                  }
                  onMouseDown={(event) => event.stopPropagation()}
                  disabled={isWorking}
                  className="bg-slate-50 p-3 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50"
                  title={item.isPublic ? t('fields.makeInternal') : t('fields.makeVisible')}
                  aria-label={item.isPublic ? t('fields.makeFieldInternal', { name: fieldName }) : t('fields.makeFieldVisible', { name: fieldName })}
                >
                  {item.isPublic ? (
                    <Eye size={20} className="text-[var(--brand-cyan-dark)]" />
                  ) : (
                    <EyeOff size={20} className="text-amber-500" />
                  )}
                </button>
                <span
                  className={`rounded-xl p-3 text-slate-400 ${
                    canReorderFields ? 'bg-slate-50' : 'bg-slate-100 opacity-50'
                  }`}
                  title={canReorderFields ? t('fields.dragReorder') : t('fields.savingOrderShort')}
                >
                  {workingFieldId === 'reordering' ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <GripVertical size={20} />
                  )}
                </span>
              </div>
              {isCore ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openCoreEditor(item)}
                    onMouseDown={(event) => event.stopPropagation()}
                    disabled={isWorking}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    title={t('fields.editCore')}
                  >
                    <Pencil size={13} />
                    {t('common.edit')}
                  </button>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {t('fields.core')}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openOptionsEditor(item.field)}
                    onMouseDown={(event) => event.stopPropagation()}
                    disabled={isWorking}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    title={t('fields.editField')}
                  >
                    <Pencil size={13} />
                    {t('common.edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => archiveField(item.field.id)}
                    onMouseDown={(event) => event.stopPropagation()}
                    disabled={isWorking}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors group disabled:opacity-50"
                    title={t('fields.deleteField')}
                  >
                    {workingFieldId === item.field.id ? (
                      <Loader2 size={18} className="animate-spin text-slate-400" />
                    ) : (
                      <Trash2
                        size={18}
                        className="text-slate-300 group-hover:text-red-500 transition-colors"
                      />
                    )}
                  </button>
                </div>
              )}
            </div>

            <div className="mb-3 flex items-start justify-between gap-3">
              <h3 className="text-lg font-black text-slate-900">{fieldName}</h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                #{index + 1}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-block px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
                {item.isPublic ? t('fields.visible') : t('inventory.internal')}
              </span>
              <span className="inline-block px-3 py-1 bg-cyan-50 text-cyan-700 rounded-full text-xs font-semibold">
                {dataType}
              </span>
              <span className="inline-block px-3 py-1 bg-slate-50 text-slate-500 rounded-full text-xs font-semibold">
                {fieldKey}
              </span>
              {!isCore && item.field.inputMode === 'single_select' && item.field.options.length > 0 && (
                <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
                  {t('fields.dropdown', { count: item.field.options.length })}
                </span>
              )}
              {!isCore && item.field.inputMode !== 'single_select' && (
                <span className="inline-block px-3 py-1 bg-slate-50 text-slate-500 rounded-full text-xs font-semibold">
                  {t('fields.freeInput')}
                </span>
              )}
              {isCore && canEditCoreOptions(item.core.key) && (
                <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
                  {t('fields.optionsCount', { count: coreFieldOptions(fieldLayoutConfig, item.core.key).length })}
                </span>
              )}
            </div>
          </div>
          );
        })}

        <button
          onClick={() => setShowModal(true)}
          className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-4 border-dashed border-cyan-200 p-6 transition-all hover:border-[var(--brand-cyan-dark)] hover:bg-cyan-50 sm:rounded-[3rem]"
        >
          <div className="p-3 bg-slate-50 rounded-xl mb-3 group-hover:bg-blue-100 transition-colors">
            {isLoading ? (
              <Loader2 size={24} className="animate-spin text-slate-400" />
            ) : (
              <Plus size={24} className="text-slate-400 group-hover:text-[var(--brand-cyan-dark)] transition-colors" />
            )}
          </div>
          <p className="text-sm font-semibold text-slate-600 group-hover:text-[var(--brand-cyan-dark)] transition-colors">
            {t('fields.addField')}
          </p>
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-3 backdrop-blur-md sm:p-4">
          <div className="max-h-[calc(100vh-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 sm:rounded-[3rem] sm:p-8">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-slate-900">{t('fields.addNewField')}</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={24} className="text-slate-600" />
              </button>
            </div>

            <form
              className="space-y-6"
              onSubmit={(event) => {
                event.preventDefault();
                void createField();
              }}
            >
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                  {t('fields.englishLabel')}
                </label>
                <input
                  type="text"
                  value={newFieldName}
                  onChange={(event) => setNewFieldName(event.target.value)}
                  placeholder={t('fields.fieldNamePlaceholder')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400"
                />
                <p className="mt-2 text-xs text-slate-500">{t('fields.translationHelp')}</p>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                  {t('fields.russianLabel')}
                </label>
                <input
                  type="text"
                  value={newFieldNameRu}
                  onChange={(event) => setNewFieldNameRu(event.target.value)}
                  placeholder={t('fields.russianLabelOptional')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                  {t('fields.georgianLabel')}
                </label>
                <input
                  type="text"
                  value={newFieldNameKa}
                  onChange={(event) => setNewFieldNameKa(event.target.value)}
                  placeholder={t('fields.georgianLabelOptional')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                  {t('fields.fieldType')}
                </label>
                <select
                  value={newFieldDataType}
                  onChange={(event) => setNewFieldDataType(event.target.value as FieldDataType)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900"
                >
                  <option value="text">{t('fields.text')}</option>
                  <option value="number">{t('fields.number')}</option>
                  <option value="boolean">{t('fields.boolean')}</option>
                  <option value="date">{t('fields.date')}</option>
                  <option value="url">{t('fields.url')}</option>
                  <option value="image">{t('fields.imageUrl')}</option>
                </select>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={newFieldOptionsEnabled}
                    onChange={(event) => {
                      setNewFieldOptionsEnabled(event.target.checked);
                      if (event.target.checked && newFieldOptionDrafts.length === 0) {
                        setNewFieldOptionDrafts(['']);
                      }
                    }}
                    className="w-5 h-5 rounded-lg border border-slate-300 cursor-pointer accent-cyan-600"
                  />
                  <span className="text-sm font-semibold text-slate-900">
                    {t('fields.addFixedOptions')}
                  </span>
                </label>

                {newFieldOptionsEnabled && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                        {t('fields.options')}
                      </p>
                      <button
                        type="button"
                        onClick={() => setNewFieldOptionDrafts((current) => [...current, ''])}
                        className="brand-control rounded-lg border px-3 py-2 text-xs font-bold text-slate-700 hover:bg-white"
                      >
                        {t('fields.addOption')}
                      </button>
                    </div>

                    <FieldOptionDrafts
                      drafts={newFieldOptionDrafts}
                      onChange={updateNewFieldOptionDraft}
                      onRemove={removeNewFieldOptionDraft}
                      optionPlaceholder={(index) => t('fields.optionPlaceholder', { number: index + 1 })}
                      deleteLabel={t('common.delete')}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={isPublic}
                  onChange={(event) => setIsPublic(event.target.checked)}
                  className="w-5 h-5 rounded-lg border border-slate-300 cursor-pointer accent-cyan-600"
                />
                <label htmlFor="isPublic" className="text-sm font-semibold text-slate-900 cursor-pointer">
                  {t('fields.publicVisibility')}
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={workingFieldId === 'creating' || !newFieldName.trim()}
                  className="brand-primary flex-1 py-3 rounded-2xl font-semibold transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {workingFieldId === 'creating' ? t('fields.creating') : t('fields.createField')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-white border border-slate-200 text-slate-900 font-semibold py-3 rounded-2xl hover:bg-slate-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {coreFieldEditor && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-3 backdrop-blur-md sm:p-4">
          <div className="max-h-[calc(100vh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 sm:max-h-[calc(100vh-2rem)] sm:rounded-[3rem] sm:p-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-black text-slate-900">{t('fields.editCoreTitle')}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t('fields.editCoreDescription')}
                </p>
              </div>
              <button
                type="button"
                onClick={closeCoreEditor}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                aria-label={t('fields.closeCoreEditor')}
              >
                <X size={24} className="text-slate-600" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                  {t('fields.fieldName')}
                </label>
                <input
                  type="text"
                  value={coreFieldName}
                  onChange={(event) => setCoreFieldName(event.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900"
                />
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <input
                  type="checkbox"
                  checked={coreFieldIsPublic}
                  onChange={(event) => setCoreFieldIsPublic(event.target.checked)}
                  className="w-5 h-5 rounded-lg border border-slate-300 cursor-pointer accent-cyan-600"
                />
                <span className="text-sm font-semibold text-slate-900">
                  {t('fields.publicVisibility')}
                </span>
              </label>

              {canEditCoreOptions(coreFieldEditor.field.key) && (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                      {t('fields.dropdownOptions')}
                    </p>
                    {coreFieldEditor.field.key !== 'category' && (
                      <button
                        type="button"
                        onClick={() => setCoreOptionDrafts((current) => [...current, ''])}
                        className="brand-control rounded-lg border px-3 py-2 text-xs font-bold text-slate-700 hover:bg-cyan-50"
                      >
                        {t('fields.addOption')}
                      </button>
                    )}
                  </div>

                  {coreFieldEditor.field.key === 'category' && (
                    <p className="text-xs font-semibold text-slate-500">
                      {t('fields.categoryNote')}
                    </p>
                  )}

                  <FieldOptionDrafts
                    drafts={coreOptionDrafts}
                    onChange={updateCoreOptionDraft}
                    onRemove={removeCoreOptionDraft}
                    optionPlaceholder={(index) => t('fields.optionPlaceholder', { number: index + 1 })}
                    deleteLabel={t('common.delete')}
                    deleteButtonClassName="h-11 rounded-lg border border-rose-200 bg-white px-3 text-xs font-bold text-rose-700 hover:bg-rose-50"
                    fixedValues={
                      coreFieldEditor.field.key === 'category'
                        ? CATEGORY_OPTION_VALUES_FOR_FIELDS
                        : undefined
                    }
                    fixedValueLabel={(value) => t('fields.savesAs', { value })}
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={saveCoreEditor}
                  disabled={!coreFieldName.trim()}
                  className="brand-primary flex-1 py-3 rounded-2xl font-semibold transition-colors disabled:bg-slate-300"
                >
                  {t('fields.saveField')}
                </button>
                <button
                  type="button"
                  onClick={closeCoreEditor}
                  className="flex-1 bg-white border border-slate-200 text-slate-900 font-semibold py-3 rounded-2xl hover:bg-slate-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {optionsField && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-3 backdrop-blur-md sm:p-4">
          <div className="max-h-[calc(100vh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 sm:max-h-[calc(100vh-2rem)] sm:rounded-[3rem] sm:p-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-black text-slate-900">{t('fields.editFieldTitle')}</h2>
                <p className="mt-1 text-sm text-slate-500">{t('fields.editFieldDescription')}</p>
              </div>
              <button
                type="button"
                onClick={closeOptionsEditor}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                aria-label={t('fields.closeOptions')}
              >
                <X size={24} className="text-slate-600" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                  {t('fields.englishLabel')}
                </label>
                <input
                  type="text"
                  value={optionsFieldName}
                  onChange={(event) => setOptionsFieldName(event.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900"
                />
                <p className="mt-2 text-xs text-slate-500">{t('fields.translationHelp')}</p>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                  {t('fields.russianLabel')}
                </label>
                <input
                  type="text"
                  value={optionsFieldNameRu}
                  onChange={(event) => setOptionsFieldNameRu(event.target.value)}
                  placeholder={t('fields.russianLabelOptional')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                  {t('fields.georgianLabel')}
                </label>
                <input
                  type="text"
                  value={optionsFieldNameKa}
                  onChange={(event) => setOptionsFieldNameKa(event.target.value)}
                  placeholder={t('fields.georgianLabelOptional')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
                  {t('fields.fieldType')}
                </label>
                <select
                  value={optionsFieldDataType}
                  onChange={(event) => setOptionsFieldDataType(event.target.value as FieldDataType)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900"
                >
                  <option value="text">{t('fields.text')}</option>
                  <option value="number">{t('fields.number')}</option>
                  <option value="boolean">{t('fields.boolean')}</option>
                  <option value="date">{t('fields.date')}</option>
                  <option value="url">{t('fields.url')}</option>
                  <option value="image">{t('fields.imageUrl')}</option>
                </select>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <input
                  type="checkbox"
                  checked={optionsFieldIsPublic}
                  onChange={(event) => setOptionsFieldIsPublic(event.target.checked)}
                  className="w-5 h-5 rounded-lg border border-slate-300 cursor-pointer accent-cyan-600"
                />
                <span className="text-sm font-semibold text-slate-900">
                  {t('fields.publicVisibility')}
                </span>
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <input
                  type="checkbox"
                  checked={optionsEnabled}
                  onChange={(event) => {
                    setOptionsEnabled(event.target.checked);
                    if (event.target.checked && optionDrafts.length === 0) {
                      setOptionDrafts(['']);
                    }
                  }}
                  className="w-5 h-5 rounded-lg border border-slate-300 cursor-pointer accent-cyan-600"
                />
                <span className="text-sm font-semibold text-slate-900">
                  {t('fields.useFixedOptions')}
                </span>
              </label>

              {optionsEnabled && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                      {t('fields.options')}
                    </p>
                    <button
                      type="button"
                      onClick={() => setOptionDrafts((current) => [...current, ''])}
                      className="brand-control rounded-lg border px-3 py-2 text-xs font-bold text-slate-700 hover:bg-cyan-50"
                    >
                      {t('fields.addOption')}
                    </button>
                  </div>

                  <FieldOptionDrafts
                    drafts={optionDrafts}
                    onChange={updateOptionDraft}
                    onRemove={removeOptionDraft}
                    onMove={moveOptionDraft}
                    optionPlaceholder={(index) => t('fields.optionPlaceholder', { number: index + 1 })}
                    deleteLabel={t('common.delete')}
                    deleteButtonClassName="h-11 rounded-lg border border-rose-200 px-2 text-xs font-bold text-rose-700 hover:bg-rose-50"
                    upLabel={t('fields.up')}
                    downLabel={t('fields.down')}
                  />
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                {t('fields.fixedOptionsHelp')}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => void saveOptions()}
                  disabled={workingFieldId === optionsField.id || !optionsFieldName.trim()}
                  className="brand-primary flex-1 py-3 rounded-2xl font-semibold transition-colors disabled:bg-slate-300"
                >
                  {workingFieldId === optionsField.id ? t('common.saving') : t('fields.saveField')}
                </button>
                <button
                  type="button"
                  onClick={closeOptionsEditor}
                  className="flex-1 bg-white border border-slate-200 text-slate-900 font-semibold py-3 rounded-2xl hover:bg-slate-50 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
