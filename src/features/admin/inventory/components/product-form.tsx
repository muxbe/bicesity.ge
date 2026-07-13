'use client';

import { useRef } from 'react';
import type { FormEvent } from 'react';
import { Loader2, X } from 'lucide-react';
import {
  type ProductCategory,
  type AttributeDTO,
} from '@/features/catalog';
import {
  buildFieldLayoutItems,
  coreFieldOptions,
  type FieldLayoutItem,
} from '@/features/fields/field-layout';
import { useFieldLayout } from '@/features/fields';
import type { ProductFormDraft } from '@/features/admin/inventory/types';
import { ProductImage } from '@/features/admin/inventory/components/product-image';
import { valuesForCategory } from '@/features/admin/inventory/utils/product-draft';
import {
  categoryLabel,
  driveTypeLabel,
  fieldNameLabel,
  useI18n,
} from '@/lib/i18n';

export function ProductForm({
  title,
  draft,
  attributes,
  onChange,
  onSubmit,
  onClose,
  canChangeCategory,
  isSaving,
  canUploadImage,
  isUploadingImage,
  onImageFileSelected,
}: {
  title: string;
  draft: ProductFormDraft;
  attributes: AttributeDTO[];
  onChange: (next: ProductFormDraft) => void;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
  canChangeCategory: boolean;
  isSaving: boolean;
  canUploadImage: boolean;
  isUploadingImage: boolean;
  onImageFileSelected: (file: File) => void | Promise<void>;
}) {
  const { locale, t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const images = draft.images.length > 0 ? draft.images : draft.image ? [draft.image] : [];
  const setImages = (nextImages: string[]) => {
    const normalized = nextImages.map((image) => image.trim()).filter(Boolean).slice(0, 5);
    onChange({ ...draft, images: normalized, image: normalized[0] ?? '' });
  };
  const { config: fieldLayoutConfig } = useFieldLayout();
  const fieldLayoutItems = buildFieldLayoutItems(
    draft.category,
    attributes,
    fieldLayoutConfig
  );
  const categoryOptions = coreFieldOptions(fieldLayoutConfig, 'category')
    .filter((option) => option.value === 'Bicycle' || option.value === 'Parts');
  const driveTypeOptions = (() => {
    const options = coreFieldOptions(fieldLayoutConfig, 'drive_type');
    if (draft.type && !options.some((option) => option.value === draft.type)) {
      return [...options, { label: draft.type, value: draft.type }];
    }
    return options;
  })();

  const updateFieldValue = (attributeId: string, value: string) => {
    onChange({
      ...draft,
      values: {
        ...draft.values,
        [attributeId]: value,
      },
    });
  };

  const changeCategory = (category: ProductCategory) => {
    onChange({
      ...draft,
      category,
      type: category === 'Parts' ? 'Manual' : draft.type,
      values: valuesForCategory(draft.values, category, attributes),
    });
  };

  const renderImageField = () => (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      {images[0] && (
        <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-2">
          <div className="relative h-44 w-full overflow-hidden rounded-xl">
            <ProductImage src={images[0]} alt={t('inventory.primaryProductPreview')} category={draft.category} className="object-cover" />
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-600">{t('inventory.primaryImage')}</p>
        </div>
      )}

      {images.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {images.map((image, index) => (
            <div key={`${image}-${index}`} className="rounded-lg border border-slate-200 bg-white p-1">
              <div className="relative h-20 overflow-hidden rounded-md bg-slate-100">
                <ProductImage src={image} alt={t('inventory.productImage', { number: index + 1 })} category={draft.category} className="object-cover" />
              </div>
              <div className="mt-1 grid grid-cols-1 gap-1">
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => setImages([image, ...images.filter((_, imageIndex) => imageIndex !== index)])}
                    className="h-7 rounded-md border border-cyan-200 text-xs font-bold text-cyan-700 hover:bg-cyan-50"
                  >
                    {t('inventory.makePrimary')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setImages(images.filter((_, imageIndex) => imageIndex !== index))}
                  className="h-7 rounded-md border border-rose-200 text-xs font-bold text-rose-700 hover:bg-rose-50"
                >
                  {t('inventory.remove')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {canUploadImage ? (
        <div className="text-sm text-slate-700">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            disabled={isUploadingImage || images.length >= 5}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void onImageFileSelected(file);
              }
              event.currentTarget.value = '';
            }}
          />
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={isUploadingImage || images.length >= 5}
              onClick={() => fileInputRef.current?.click()}
              className="h-10 px-4 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {images.length > 0 ? t('inventory.addPhoto') : t('inventory.addFirstPhoto')}
            </button>
            {images.length > 0 && (
              <button
                type="button"
                onClick={() => setImages([])}
                className="h-10 px-4 rounded-xl border border-rose-300 text-sm font-semibold text-rose-700 hover:bg-rose-50"
              >
                {t('inventory.removeAll')}
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {t('inventory.imageHelp', { count: images.length })}
          </p>
          {isUploadingImage && (
            <span className="mt-2 inline-flex items-center gap-2 text-xs text-slate-500">
              <Loader2 size={12} className="animate-spin" />
              {t('common.uploading')}
            </span>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {t('inventory.imageDisabled')}
        </div>
      )}
    </div>
  );

  const renderCustomField = (attribute: AttributeDTO) => {
    const value = draft.values[attribute.id] ?? '';
    if (attribute.inputMode === 'single_select' && attribute.options.length > 0) {
      return (
        <select
          value={value}
          onChange={(event) => updateFieldValue(attribute.id, event.target.value)}
          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
          aria-label={fieldNameLabel(attribute, locale)}
        >
          <option value="">{t('inventory.selectField', { name: fieldNameLabel(attribute, locale) })}</option>
          {attribute.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (attribute.dataType === 'boolean') {
      return (
        <select
          value={value}
          onChange={(event) => updateFieldValue(attribute.id, event.target.value)}
          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
          aria-label={fieldNameLabel(attribute, locale)}
        >
          <option value="">{t('common.unset')}</option>
          <option value="true">{t('common.yes')}</option>
          <option value="false">{t('common.no')}</option>
        </select>
      );
    }

    const inputType =
      attribute.dataType === 'number'
        ? 'number'
        : attribute.dataType === 'date'
        ? 'date'
        : attribute.dataType === 'url' || attribute.dataType === 'image'
        ? 'url'
        : 'text';

    return (
      <input
        type={inputType}
        value={value}
        onChange={(event) => updateFieldValue(attribute.id, event.target.value)}
        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
        placeholder={attribute.isPublic ? t('inventory.visibleFieldValue') : t('inventory.internalValue')}
        aria-label={fieldNameLabel(attribute, locale)}
      />
    );
  };

  const renderCoreField = (item: Extract<FieldLayoutItem, { kind: 'core' }>) => {
    switch (item.core.key) {
      case 'category':
        return (
          <select value={draft.category} disabled={!canChangeCategory} onChange={(event) => changeCategory(event.target.value as ProductCategory)} className="h-11 rounded-xl border border-slate-300 px-3 text-sm disabled:bg-slate-100">
            {(categoryOptions.length > 0 ? categoryOptions : [
              { label: t('common.bicycle'), value: 'Bicycle' },
              { label: t('common.parts'), value: 'Parts' },
            ]).map((option) => (
              <option key={option.value} value={option.value}>
                {option.value === 'Bicycle' || option.value === 'Parts' ? categoryLabel(option.value, t) : option.label}
              </option>
            ))}
          </select>
        );
      case 'name':
        return <input value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" placeholder={t('common.name')} />;
      case 'drive_type':
        return (
          <select value={draft.type} disabled={draft.category === 'Parts'} onChange={(event) => onChange({ ...draft, type: event.target.value })} className="h-11 rounded-xl border border-slate-300 px-3 text-sm disabled:bg-slate-100">
            {(driveTypeOptions.length > 0 ? driveTypeOptions : [
              { label: t('common.manual'), value: 'Manual' },
              { label: t('common.electrical'), value: 'Electrical' },
            ]).map((option) => (
              <option key={option.value} value={option.value}>
                {driveTypeLabel(option.value, t)}
              </option>
            ))}
          </select>
        );
      case 'serial':
        return <input value={draft.serial} onChange={(event) => onChange({ ...draft, serial: event.target.value })} className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" placeholder={t('common.serial')} />;
      case 'price':
        return <input type="number" min="0" step="0.01" value={draft.price} onChange={(event) => onChange({ ...draft, price: event.target.value })} className="h-11 rounded-xl border border-slate-300 px-3 text-sm" placeholder={t('common.price')} />;
      case 'stock_count':
        return <input type="number" min="0" step="1" value={draft.stockCount} onChange={(event) => onChange({ ...draft, stockCount: event.target.value })} className="h-11 rounded-xl border border-slate-300 px-3 text-sm" placeholder={t('common.stock')} />;
      case 'discount':
        return (
          <div>
            <input
              value={draft.discountInput}
              onChange={(event) => onChange({ ...draft, discountInput: event.target.value })}
              className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
              placeholder={t('inventory.discountPlaceholder')}
            />
            <p className="mt-1 text-xs text-slate-500">
              {t('inventory.discountHelp')}
            </p>
          </div>
        );
      case 'image':
        return renderImageField();
      case 'description':
        return <textarea rows={3} value={draft.description} onChange={(event) => onChange({ ...draft, description: event.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder={t('common.description')} />;
      default:
        return null;
    }
  };

  const renderFieldLayoutItem = (item: FieldLayoutItem) => (
    <div key={item.id}>
      <p className="mb-1 text-xs font-semibold text-slate-500">
        {item.kind === 'core' ? item.core.name : fieldNameLabel(item.field, locale)}
      </p>
      {item.kind === 'core' ? renderCoreField(item) : renderCustomField(item.field)}
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="flex min-h-[min(42rem,calc(100vh-1.5rem))] flex-col">
      <div className="sticky -top-4 z-10 -mx-4 -mt-4 mb-2 flex justify-between gap-3 border-b border-slate-100 bg-white px-4 py-4 sm:-top-6 sm:-mx-6 sm:-mt-6 sm:px-6">
        <h2 className="text-lg font-black text-slate-900 sm:text-xl">{title}</h2>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100" aria-label={t('inventory.closeForm')}>
          <X size={18} />
        </button>
      </div>
      <div className="space-y-3 py-3">
        {fieldLayoutItems.map(renderFieldLayoutItem)}
      </div>
      <div className="product-form-actions-footer sticky -bottom-4 z-10 -mx-4 -mb-4 mt-auto grid grid-cols-1 gap-3 border-t border-slate-100 bg-white px-4 py-4 sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:grid-cols-2 sm:px-6">
        <button type="button" onClick={onClose} aria-label={t('common.cancel')} className="brand-control h-11 rounded-xl border text-sm font-semibold text-slate-700 hover:bg-cyan-50">
          {t('common.cancel')}
        </button>
        <button type="submit" aria-label={t('inventory.saveProduct')} disabled={isSaving || isUploadingImage} className="brand-primary h-11 rounded-xl text-sm font-semibold disabled:opacity-50">
          {isSaving ? t('common.saving') : isUploadingImage ? t('inventory.uploadingImage') : t('inventory.saveProduct')}
        </button>
      </div>
    </form>
  );
}
