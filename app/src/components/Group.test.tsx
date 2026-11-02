import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Group } from './Group';

test('shows the caption and its rows', async () => {
  await render(
    <Group title="Profile">
      <Text>First row</Text>
      <Text>Second row</Text>
    </Group>,
  );
  expect(screen.getByText('Profile')).toBeTruthy();
  expect(screen.getByText('First row')).toBeTruthy();
  expect(screen.getByText('Second row')).toBeTruthy();
});
