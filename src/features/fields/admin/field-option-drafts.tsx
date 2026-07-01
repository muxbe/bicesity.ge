"use client";

export type FieldOptionDraftsProps = {
  drafts: string[];
  onAdd?: () => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  onMove?: (index: number, direction: -1 | 1) => void;
  optionPlaceholder: (index: number) => string;
  addOptionLabel?: string;
  deleteLabel: string;
  deleteButtonClassName?: string;
  upLabel?: string;
  downLabel?: string;
  fixedValues?: readonly string[];
  fixedValueLabel?: (value: string) => string;
  canRemoveFixedValues?: boolean;
};

export function FieldOptionDrafts({
  drafts,
  onAdd,
  onChange,
  onRemove,
  onMove,
  optionPlaceholder,
  addOptionLabel,
  deleteLabel,
  deleteButtonClassName = "h-11 rounded-lg border border-rose-200 px-3 text-xs font-bold text-rose-700 hover:bg-rose-50",
  upLabel,
  downLabel,
  fixedValues,
  fixedValueLabel,
  canRemoveFixedValues = false,
}: FieldOptionDraftsProps) {
  return (
    <>
      {onAdd && addOptionLabel && (
        <button
          type="button"
          onClick={onAdd}
          className="brand-control rounded-lg border px-3 py-2 text-xs font-bold text-slate-700 hover:bg-cyan-50"
        >
          {addOptionLabel}
        </button>
      )}
      {drafts.map((option, index) => {
        const fixedValue = fixedValues?.[index];
        const showFixedValue = fixedValue !== undefined && !canRemoveFixedValues;

        return (
          <div key={index} className="grid grid-cols-[1fr,auto] gap-2">
            <input
              value={option}
              onChange={(event) => onChange(index, event.target.value)}
              placeholder={optionPlaceholder(index)}
              className="brand-control h-11 rounded-xl border px-3 text-sm"
            />
            {showFixedValue ? (
              <span className="inline-flex h-11 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-500">
                {fixedValueLabel ? fixedValueLabel(fixedValue) : fixedValue}
              </span>
            ) : onMove ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onMove(index, -1)}
                  disabled={index === 0}
                  className="h-11 rounded-lg border border-slate-200 px-2 text-xs font-bold text-slate-600 disabled:opacity-40"
                >
                  {upLabel}
                </button>
                <button
                  type="button"
                  onClick={() => onMove(index, 1)}
                  disabled={index === drafts.length - 1}
                  className="h-11 rounded-lg border border-slate-200 px-2 text-xs font-bold text-slate-600 disabled:opacity-40"
                >
                  {downLabel}
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className={deleteButtonClassName}
                >
                  {deleteLabel}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onRemove(index)}
                className={deleteButtonClassName}
              >
                {deleteLabel}
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}
