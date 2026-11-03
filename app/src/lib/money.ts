const decimalsCache = new Map<string, number>();

/** Minor-unit digits of a currency per CLDR, the same digits the backend uses. */
export function currencyDecimals(currency: string): number {
  let decimals = decimalsCache.get(currency);
  if (decimals === undefined) {
    decimals = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions?.().maximumFractionDigits ?? 2;
    decimalsCache.set(currency, decimals);
  }
  return decimals;
}

export function formatMoney(minor: number, currency: string, locale: string): string {
  const decimals = currencyDecimals(currency);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(minor / 10 ** decimals);
}

/** The currency's symbol in this locale ("€", "US$"). Hermes on iOS has no NumberFormat#formatToParts, so fall back to stripping a formatted zero. */
export function currencySymbol(currency: string, locale: string): string {
  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const symbol =
    typeof formatter.formatToParts === 'function'
      ? formatter.formatToParts(0).find((p) => p.type === 'currency')?.value
      : formatter.format(0).replace(/[\d\s.,  -]/g, '');
  return symbol || currency;
}

/**
 * Parses what people type ("12.99", "12,99", "1.299,50", "1,600") into minor units.
 * The last separator is the decimal mark when 1..decimals digits follow it; a
 * separator followed by exactly three digits is a thousands separator when the
 * currency has fewer than three decimals. Returns null for anything else.
 */
export function parseMoney(input: string, currency: string): number | null {
  const decimals = currencyDecimals(currency);
  const s = input.trim().replace(/[\s ']/g, '');
  if (!/^\d[\d.,]*$/.test(s)) return null;

  const last = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  let whole = s;
  let fraction = '';

  if (last !== -1) {
    const tail = s.slice(last + 1);
    const isDecimal = tail.length >= 1 && tail.length <= decimals && !(tail.length === 3 && decimals < 3);
    if (isDecimal) {
      whole = s.slice(0, last);
      fraction = tail;
    } else if (tail.length !== 3) {
      return null;
    }
  }

  if (!/^\d+$/.test(whole) && !/^\d{1,3}([.,]\d{3})+$/.test(whole)) return null;

  const minor = Number(whole.replace(/[.,]/g, '')) * 10 ** decimals + Number(fraction.padEnd(decimals, '0') || '0');
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Minor units as an editable decimal string ("12.99"). */
export function minorToInput(minor: number, currency: string): string {
  const decimals = currencyDecimals(currency);
  return (minor / 10 ** decimals).toFixed(decimals);
}
