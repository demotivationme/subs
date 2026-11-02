import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { renderWithProviders } from '@/test/utils';

import { HeaderAddButton } from './HeaderAddButton';

test('opens the add-subscription flow', async () => {
  await renderWithProviders(<HeaderAddButton />);

  await fireEvent.press(screen.getByRole('button', { name: 'Add subscription' }));

  expect(router.push).toHaveBeenCalledWith('/subscriptions/new');
});
