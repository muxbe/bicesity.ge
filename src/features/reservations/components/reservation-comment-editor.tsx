"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { getReservationRepository } from "@/features/reservations";
import { CRITICAL_INVALIDATION_TAGS } from "@/features/shared/freshness/critical-field-registry";
import { publishInvalidation } from "@/features/shared/freshness/invalidation";

type ReservationCommentEditorProps = {
  reservationId: string;
  initialComment: string;
  onSaved?: () => Promise<void> | void;
};

function parseError(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to save reservation comment.";
}

export function ReservationCommentEditor({
  reservationId,
  initialComment,
  onSaved,
}: ReservationCommentEditorProps) {
  const repository = useMemo(() => getReservationRepository(), []);
  const [draft, setDraft] = useState(initialComment);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initialComment);
    setError(null);
    setSavedMessage(null);
  }, [initialComment, reservationId]);

  const isDirty = draft.trim() !== initialComment.trim();

  const save = async () => {
    setIsSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      await repository.updateSellerComment(reservationId, draft);
      publishInvalidation(CRITICAL_INVALIDATION_TAGS.RESERVATIONS_CRITICAL);
      setSavedMessage("Comment saved.");
      await onSaved?.();
    } catch (caughtError) {
      setError(parseError(caughtError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
        <MessageSquare size={14} />
        Seller Comment
      </div>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="Add reservation note for staff..."
        className="brand-control w-full resize-y rounded-lg border px-3 py-2 text-sm text-slate-900"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">{draft.length}/2000</p>
        <button
          type="button"
          onClick={() => void save()}
          disabled={isSaving || !isDirty}
          className="brand-primary inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold disabled:bg-slate-300"
        >
          {isSaving && <Loader2 size={14} className="animate-spin" />}
          Save Comment
        </button>
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p>}
      {savedMessage && <p className="mt-2 text-xs font-semibold text-emerald-700">{savedMessage}</p>}
    </div>
  );
}
