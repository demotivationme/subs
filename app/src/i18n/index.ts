import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';

/** Adding a language: add locales/<xx>.json, list it here and add it to `resources`. */
export const SUPPORTED_LOCALES = ['en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const resources = {
  en: { translation: en },
} satisfies Record<Locale, { translation: typeof en }>;

export function supportedLocale(tag?: string | null): Locale {
  const code = tag?.toLowerCase().split(/[-_]/)[0] ?? '';
  return (SUPPORTED_LOCALES as readonly string[]).includes(code) ? (code as Locale) : 'en';
}

export function deviceLocale(): Locale {
  return supportedLocale(getLocales()[0]?.languageTag);
}

// eslint-disable-next-line import/no-named-as-default-member -- the default instance is the documented API
void i18n.use(initReactI18next).init({
  resources,
  lng: deviceLocale(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
