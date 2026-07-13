'use client';

import { AddFieldModal } from '@/features/fields/admin/add-field-modal';
import { FieldCardGrid } from '@/features/fields/admin/field-card-grid';
import { FieldSettingsToolbar } from '@/features/fields/admin/field-settings-toolbar';
import { FieldLayoutReviewBanner } from '@/features/fields/admin/field-layout-review-banner';
import { EditCoreFieldModal } from '@/features/fields/admin/edit-core-field-modal';
import { EditCustomFieldModal } from '@/features/fields/admin/edit-custom-field-modal';
import { useFieldSettingsController } from '@/features/fields/admin/use-field-settings-controller';
import { useI18n } from '@/lib/i18n';

export function FieldSettingsView() {
  const { locale, t } = useI18n();
  const {
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
    needsLayoutReview,
    layoutStorageReady,
    isLayoutReviewSaving,
    legacyFieldLayoutConfig,
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
    confirmLayoutReview,
  } = useFieldSettingsController(t);
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

      <FieldLayoutReviewBanner
        needsReview={needsLayoutReview}
        storageReady={layoutStorageReady}
        isSaving={isLayoutReviewSaving}
        legacyConfig={legacyFieldLayoutConfig}
        t={t}
        onImportLegacy={() => void confirmLayoutReview(true)}
        onUseDefaults={() => void confirmLayoutReview(false)}
      />

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
