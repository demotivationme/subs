import { useTranslation } from 'react-i18next';

/** The active UI language, for Intl money and date formatting. */
export function useLocale(): string {
  return useTranslation().i18n.language;
}
