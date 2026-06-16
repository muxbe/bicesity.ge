export function parseActionError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Action failed. Try again.';
}

export function getApiErrorMessage(payload: { error?: string; details?: unknown } | null, fallback: string) {
  const message = payload?.error ?? fallback;
  const details = payload?.details;
  if (
    details &&
    typeof details === 'object' &&
    'message' in details &&
    typeof details.message === 'string'
  ) {
    return `${message} ${details.message}`;
  }
  return message;
}
