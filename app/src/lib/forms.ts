import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { ApiError } from '@/api/errors';

/**
 * Shows a 422's field errors under the form's fields. `fields` are form fields that share
 * the API's name; `fieldMap` maps other API names (snake_case) to form fields.
 * Returns false when nothing was mapped, so the caller shows a form-level message instead.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
  fieldMap: Partial<Record<string, Path<T>>> = {},
): boolean {
  if (!(error instanceof ApiError) || error.status !== 422) return false;

  let mapped = false;
  for (const [key, messages] of Object.entries(error.errors)) {
    const field = fieldMap[key] ?? (fields.includes(key as Path<T>) ? (key as Path<T>) : undefined);
    if (field && messages[0]) {
      setError(field, { type: 'server', message: messages[0] });
      mapped = true;
    }
  }
  return mapped;
}
