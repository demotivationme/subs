import { fireEvent, render, screen } from '@testing-library/react-native';

import '@/i18n';

import { DatePickerModal } from './DatePickerModal';

test('iOS: picking a day and pressing Done saves it as YYYY-MM-DD', async () => {
  const onSave = jest.fn();
  await render(<DatePickerModal visible title="Next payment" value="2026-11-10" fallback="2026-11-09" onSave={onSave} onClose={jest.fn()} />);

  // The shape the native iOS picker sends; the library turns it into (event, date).
  await fireEvent(screen.getByTestId('date-picker'), 'onChange', { nativeEvent: { timestamp: new Date(2026, 11, 24).getTime(), utcOffset: 0 } });
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

  expect(onSave).toHaveBeenCalledWith('2026-12-24');
});

test('iOS: an empty value opens on the fallback day', async () => {
  const onSave = jest.fn();
  await render(<DatePickerModal visible title="Next payment" value="" fallback="2026-11-09" onSave={onSave} onClose={jest.fn()} />);

  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

  expect(onSave).toHaveBeenCalledWith('2026-11-09');
});

test('iOS: Cancel closes without saving', async () => {
  const onSave = jest.fn();
  const onClose = jest.fn();
  await render(<DatePickerModal visible title="Next payment" value="2026-11-10" fallback="2026-11-09" onSave={onSave} onClose={onClose} />);

  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

  expect(onClose).toHaveBeenCalled();
  expect(onSave).not.toHaveBeenCalled();
});
