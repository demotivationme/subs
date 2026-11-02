import { render, screen } from '@testing-library/react-native';

import Boot from '@/app/index';

test('the app boots with NativeWind and the @ alias', async () => {
  await render(<Boot />);
  expect(screen.getByTestId('boot')).toBeTruthy();
});
