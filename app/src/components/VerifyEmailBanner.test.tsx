import { screen } from '@testing-library/react-native';

import { keys } from '@/api/keys';
import { fixtures } from '@/test/fixtures';
import { createTestQueryClient, renderWithProviders } from '@/test/utils';

import { VerifyEmailBanner } from './VerifyEmailBanner';

test('renders nothing for verified users', async () => {
  const client = createTestQueryClient();
  client.setQueryData(keys.me, fixtures.user());
  await renderWithProviders(<VerifyEmailBanner />, client);

  expect(screen.queryByText('Verify your email to receive email reminders.')).toBeNull();
});
