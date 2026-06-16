'use client';

import { useState } from 'react';
import { parseActionError } from '@/features/admin/inventory/utils/api-errors';

type UseInventoryActionStateParams = {
  reload: () => Promise<void> | void;
};

export function useInventoryActionState({ reload }: UseInventoryActionStateParams) {
  const [workingKey, setWorkingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionErrorKey, setActionErrorKey] = useState<string | null>(null);

  const runAction = async (key: string, action: () => Promise<void>) => {
    setWorkingKey(key);
    setActionError(null);
    setActionErrorKey(null);
    try {
      await action();
      await reload();
    } catch (caughtError) {
      setActionError(parseActionError(caughtError));
      setActionErrorKey(key);
    } finally {
      setWorkingKey(null);
    }
  };

  const dismissActionError = () => {
    setActionError(null);
    setActionErrorKey(null);
  };

  return {
    workingKey,
    setWorkingKey,
    actionError,
    setActionError,
    actionErrorKey,
    setActionErrorKey,
    runAction,
    dismissActionError,
  };
}
