import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import type { ReminderRuleInput } from '@/api/types';
import '@/i18n';

import { ReminderEditor } from './ReminderEditor';

const START: ReminderRuleInput[] = [{ days_before: 1, time_of_day: '09:00', channels: ['push', 'in_app'] }];

function Harness({ onRules }: { onRules: (rules: ReminderRuleInput[]) => void }) {
  const [rules, setRules] = useState(START);
  return <ReminderEditor rules={rules} email="ana@example.com" onChange={(next) => { setRules(next); onRules(next); }} />;
}

test('edits when, time and channels, shows the account email, and adds and removes rules', async () => {
  const onRules = jest.fn();
  await render(<Harness onRules={onRules} />);

  expect(screen.getByText('ana@example.com')).toBeTruthy();

  await fireEvent.press(screen.getByRole('radio', { name: 'On the day' }));
  expect(onRules).toHaveBeenLastCalledWith([{ ...START[0], days_before: 0 }]);

  await fireEvent.press(screen.getByRole('radio', { name: 'Other…' }));
  await fireEvent.changeText(screen.getByLabelText('Days before (0 to 60)'), '14');
  expect(onRules).toHaveBeenLastCalledWith([{ ...START[0], days_before: 14 }]);

  await fireEvent.press(screen.getByRole('button', { name: 'At' }));
  await fireEvent(screen.getByTestId('date-time-picker'), 'onChange', {
    nativeEvent: { timestamp: new Date(2000, 0, 1, 18, 30).getTime(), utcOffset: 0 },
  });
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(onRules).toHaveBeenLastCalledWith([{ ...START[0], days_before: 14, time_of_day: '18:30' }]);

  await fireEvent.press(screen.getByRole('button', { name: '+ Add another reminder' }));
  expect(onRules.mock.lastCall?.[0]).toHaveLength(2);
  await fireEvent.press(screen.getByRole('button', { name: 'Remove' }));
  expect(onRules.mock.lastCall?.[0]).toHaveLength(1);
});
