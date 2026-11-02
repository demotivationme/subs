import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/utils';

import { SpendChart } from './SpendChart';

test('labels each legend row and the bar, and lists amounts and percentages', async () => {
  const items = Array.from({ length: 7 }, (_, i) => ({ key: String(i), label: `Cat ${i}`, formatted: `€${i}.00`, percent: 10 }));
  await renderWithProviders(<SpendChart items={items} />);

  expect(screen.getByLabelText('Monthly spend by category')).toBeTruthy();
  expect(screen.getByLabelText('Cat 6: €6.00, 10%')).toBeTruthy();
  expect(screen.getAllByText('10%')).toHaveLength(7);
  expect(screen.getByText('€3.00')).toBeTruthy();
});
