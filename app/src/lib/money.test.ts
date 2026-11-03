import { currencyDecimals, currencySymbol, formatMoney, minorToInput, parseMoney } from './money';

test.each([
  ['EUR', 'en', '€'],
  ['USD', 'en', '$'],
  ['JPY', 'en', '¥'],
  ['EUR', 'de', '€'],
])('currency symbol for %s in %s', (currency, locale, symbol) => {
  expect(currencySymbol(currency, locale)).toBe(symbol);
});

test('currency symbol works without NumberFormat#formatToParts (Hermes)', () => {
  const proto = Intl.NumberFormat.prototype as Partial<Intl.NumberFormat>;
  const original = proto.formatToParts;
  delete proto.formatToParts;
  try {
    expect(currencySymbol('EUR', 'en')).toBe('€');
    expect(currencySymbol('EUR', 'de')).toBe('€');
    expect(currencySymbol('USD', 'en')).toBe('$');
  } finally {
    proto.formatToParts = original;
  }
});

test('decimals come from CLDR like the backend', () => {
  expect(currencyDecimals('EUR')).toBe(2);
  expect(currencyDecimals('JPY')).toBe(0);
  expect(currencyDecimals('KWD')).toBe(3);
});

test('formats minor units', () => {
  expect(formatMoney(8734, 'EUR', 'en')).toBe('€87.34');
  expect(formatMoney(1600, 'JPY', 'en')).toBe('¥1,600');
  expect(formatMoney(5000, 'KWD', 'en')).toMatch(/5\.000/);
});

test.each([
  ['12.99', 'EUR', 1299],
  ['12,99', 'EUR', 1299],
  ['12,9', 'EUR', 1290],
  ['12', 'EUR', 1200],
  ['0', 'EUR', 0],
  ['1,299', 'EUR', 129900],
  ['1.299,50', 'EUR', 129950],
  ['1,299.5', 'EUR', 129950],
  [' 1 299,50 ', 'EUR', 129950],
  ['12.345', 'EUR', 1234500],
  ['1600', 'JPY', 1600],
  ['1,600', 'JPY', 1600],
  ['5.000', 'KWD', 5000],
  ['5,5', 'KWD', 5500],
])('parses %p in %s as %p minor units', (input, currency, expected) => {
  expect(parseMoney(input, currency)).toBe(expected);
});

test.each([
  ['', 'EUR'],
  ['abc', 'EUR'],
  ['-5', 'EUR'],
  ['1.5', 'JPY'],
  ['12,34,56.00', 'EUR'],
  ['€12', 'EUR'],
  ['.5', 'EUR'],
])('rejects %p in %s', (input, currency) => {
  expect(parseMoney(input, currency)).toBeNull();
});

test('minorToInput round-trips through parseMoney', () => {
  expect(minorToInput(1299, 'EUR')).toBe('12.99');
  expect(minorToInput(1600, 'JPY')).toBe('1600');
  expect(parseMoney(minorToInput(5000, 'KWD'), 'KWD')).toBe(5000);
});
