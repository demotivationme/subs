import { ApiError, NetworkError } from '@/api/errors';
import i18n from '@/i18n';

/** One line to show for a failed request. */
export function errorMessage(error: unknown): string {
  if (error instanceof NetworkError) return i18n.t('errors.network');
  if (error instanceof ApiError) {
    if (error.status === 429) return i18n.t('errors.tooMany');
    if (error.status === 404) return i18n.t('errors.notFound');
    if (error.status < 500 && error.message) return error.message;
  }
  return i18n.t('errors.generic');
}

/** Field messages are either our keys (client validation) or server text (already translated). */
export function translateError(message?: string): string | undefined {
  if (!message) return undefined;
  return i18n.exists(message) ? i18n.t(message) : message;
}
