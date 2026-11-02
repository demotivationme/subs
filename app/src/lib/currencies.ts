import { getLocales } from 'expo-localization';

/** Currencies with ECB reference rates (totals convert), plus EUR itself. */
export const CURRENCIES = [
  'AUD', 'BGN', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK',
  'JPY', 'KRW', 'MXN', 'MYR', 'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR',
] as const;

/** The device's currency when we can convert it, else EUR. */
export function defaultCurrency(): string {
  const code = getLocales()[0]?.currencyCode ?? '';
  return (CURRENCIES as readonly string[]).includes(code) ? code : 'EUR';
}

/** Picker options; keeps a currency outside the list (e.g. an existing subscription's) selectable. */
export function currencyOptions(current?: string): { value: string; label: string }[] {
  const codes: string[] = [...CURRENCIES];
  if (current && !codes.includes(current)) codes.unshift(current);
  return codes.map((code) => ({ value: code, label: code }));
}
