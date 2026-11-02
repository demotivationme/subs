import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from './Button';

test.each(['ink', 'ghostDanger'] as const)('the %s variant renders its label and fires', async (variant) => {
  const onPress = jest.fn();
  await render(<Button label="Go" variant={variant} onPress={onPress} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Go' }));
  expect(screen.getByText('Go')).toBeTruthy();
  expect(onPress).toHaveBeenCalledTimes(1);
});

test.each(['ink', 'ghostDanger'] as const)('the %s variant does not fire when disabled or loading', async (variant) => {
  const onPress = jest.fn();
  await render(
    <>
      <Button label="Off" variant={variant} onPress={onPress} disabled />
      <Button label="Busy" variant={variant} onPress={onPress} loading />
    </>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Off' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Busy' }));
  expect(onPress).not.toHaveBeenCalled();
  expect(screen.queryByText('Busy')).toBeNull();
});
