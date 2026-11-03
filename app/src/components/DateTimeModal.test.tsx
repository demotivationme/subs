import { fireEvent, render, screen } from '@testing-library/react-native';

import '@/i18n';

import { DateTimeModal } from './DateTimeModal';

/** The shape the native iOS picker sends; the library turns it into (event, date). */
const nativeChange = (date: Date) => ({ nativeEvent: { timestamp: date.getTime(), utcOffset: 0 } });

test('iOS date: picking a day and pressing Done saves it as YYYY-MM-DD', async () => {
  const onSave = jest.fn();
  await render(<DateTimeModal mode="date" visible title="Next payment" value="2026-11-10" fallback="2026-11-09" onSave={onSave} onClose={jest.fn()} />);

  await fireEvent(screen.getByTestId('date-time-picker'), 'onChange', nativeChange(new Date(2026, 11, 24)));
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

  expect(onSave).toHaveBeenCalledWith('2026-12-24');
});

test('iOS time: picking a time and pressing Done saves it as HH:MM', async () => {
  const onSave = jest.fn();
  await render(<DateTimeModal mode="time" visible title="Reminder time" value="09:00" fallback="09:00" onSave={onSave} onClose={jest.fn()} />);

  await fireEvent(screen.getByTestId('date-time-picker'), 'onChange', nativeChange(new Date(2000, 0, 1, 18, 5)));
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

  expect(onSave).toHaveBeenCalledWith('18:05');
});

test('iOS: an empty value opens on the fallback', async () => {
  const onSave = jest.fn();
  await render(<DateTimeModal mode="date" visible title="Next payment" value="" fallback="2026-11-09" onSave={onSave} onClose={jest.fn()} />);

  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

  expect(onSave).toHaveBeenCalledWith('2026-11-09');
});

test('iOS: Cancel closes without saving', async () => {
  const onSave = jest.fn();
  const onClose = jest.fn();
  await render(<DateTimeModal mode="time" visible title="Reminder time" value="09:00" fallback="09:00" onSave={onSave} onClose={onClose} />);

  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

  expect(onClose).toHaveBeenCalled();
  expect(onSave).not.toHaveBeenCalled();
});
