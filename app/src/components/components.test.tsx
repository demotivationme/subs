import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { AppText } from './AppText';
import { Banner } from './Banner';
import { Button } from './Button';
import { ListRow } from './ListRow';
import { MultiChoice } from './MultiChoice';
import { ProgressSteps } from './ProgressSteps';
import { SegmentedControl } from './SegmentedControl';
import { SelectField } from './SelectField';
import { ServiceIcon } from './ServiceIcon';
import { SwitchRow } from './SwitchRow';
import { TextField } from './TextField';

test('a disabled or loading button does not fire', async () => {
  const onPress = jest.fn();
  await render(<><Button label="Save" onPress={onPress} disabled /><Button label="Busy" onPress={onPress} loading /></>);

  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Busy' }));

  expect(onPress).not.toHaveBeenCalled();
});

test('a text field shows its error', async () => {
  await render(<TextField label="Email" value="" onChangeText={() => {}} error="Enter a valid email address." />);
  expect(screen.getByLabelText('Email')).toBeTruthy();
  expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
});

test('a select field picks an option from its list', async () => {
  const onChange = jest.fn();
  await render(<SelectField label="Currency" value="EUR" options={[{ value: 'EUR', label: 'EUR' }, { value: 'USD', label: 'USD' }]} onChange={onChange} />);

  await fireEvent.press(screen.getByRole('button', { name: 'Currency' }));
  await fireEvent.press(screen.getByRole('button', { name: 'USD' }));

  expect(onChange).toHaveBeenCalledWith('USD');
});

test('multi choice toggles values', async () => {
  const onChange = jest.fn();
  await render(<MultiChoice options={[{ value: 'push', label: 'Push' }, { value: 'email', label: 'Email' }]} value={['push']} onChange={onChange} />);

  await fireEvent.press(screen.getByRole('checkbox', { name: 'Email' }));
  expect(onChange).toHaveBeenLastCalledWith(['push', 'email']);

  await fireEvent.press(screen.getByRole('checkbox', { name: 'Push' }));
  expect(onChange).toHaveBeenLastCalledWith([]);
});

test('a segmented control fires onChange with the picked value', async () => {
  const onChange = jest.fn();
  await render(<SegmentedControl options={[{ value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }]} value="month" onChange={onChange} />);

  expect(screen.getByRole('radio', { name: 'Monthly' }).props.accessibilityState.selected).toBe(true);
  await fireEvent.press(screen.getByRole('radio', { name: 'Weekly' }));
  expect(onChange).toHaveBeenCalledWith('week');
});

test('a switch row toggles through its labelled switch', async () => {
  const onChange = jest.fn();
  await render(<SwitchRow label="Remind me" description="Before it renews" value={false} onChange={onChange} />);

  expect(screen.getByText('Before it renews')).toBeTruthy();
  await fireEvent(screen.getByLabelText('Remind me'), 'valueChange', true);
  expect(onChange).toHaveBeenCalledWith(true);
});

test('progress steps mark the reached bars', async () => {
  await render(<ProgressSteps count={3} current={2} />);
  expect(screen.getByTestId('step-1').props.className).toContain('bg-accent');
  expect(screen.getByTestId('step-2').props.className).toContain('bg-accent');
  expect(screen.getByTestId('step-3').props.className).toContain('bg-line');
});

test('a service icon shows the logo when there is one', async () => {
  await render(<ServiceIcon service={{ name: 'Netflix', logo_url: 'https://x.test/n.png' }} size={40} />);
  expect(screen.getByTestId('service-logo')).toBeTruthy();
  expect(screen.queryByText('N')).toBeNull();
});

test('a service icon falls back to a letter tile with its own color', async () => {
  await render(<ServiceIcon service={{ name: 'netflix', logo_url: null, color: '#123456' }} size={40} />);
  expect(screen.getByText('N')).toBeTruthy();
  expect(screen.queryByTestId('service-logo')).toBeNull();
  expect(screen.getByTestId('service-tile').props.style).toEqual(
    expect.objectContaining({ backgroundColor: '#123456', width: 40, height: 40, borderRadius: 12 }),
  );
});

test('the letter tile picks a stable palette color without a service color', async () => {
  const { toJSON } = await render(<ServiceIcon service={{ name: 'Spotify', logo_url: null }} />);
  const first = JSON.stringify(toJSON());
  await screen.unmount();
  const again = await render(<ServiceIcon service={{ name: 'Spotify', logo_url: null }} />);
  expect(JSON.stringify(again.toJSON())).toBe(first);
});

test('a list row renders its leading slot and fires onPress', async () => {
  const onPress = jest.fn();
  await render(<ListRow title="Netflix" leading={<Text>lead</Text>} onPress={onPress} />);
  expect(screen.getByText('lead')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Netflix' }));
  expect(onPress).toHaveBeenCalled();
});

test('a ghost button fires and numeric text is tabular', async () => {
  const onPress = jest.fn();
  await render(<><Button label="Skip" variant="ghost" onPress={onPress} /><AppText numeric>12,99</AppText></>);
  await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
  expect(onPress).toHaveBeenCalled();
  expect(StyleSheet.flatten(screen.getByText('12,99').props.style)).toEqual(expect.objectContaining({ fontVariant: ['tabular-nums'] }));
});

test('a warning banner shows its message and action', async () => {
  const onPress = jest.fn();
  await render(<Banner tone="warning" message="Careful" action={{ label: 'Fix', onPress }} />);
  expect(screen.getByText('Careful')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Fix' }));
  expect(onPress).toHaveBeenCalled();
});

test('a disabled SwitchRow does not fire onChange', async () => {
  const onChange = jest.fn();
  await render(<SwitchRow label="Remind me" value={false} onChange={onChange} disabled />);
  const toggle = screen.getByRole('switch', { name: 'Remind me' });
  expect(toggle.props.accessibilityState).toMatchObject({ disabled: true });
  await fireEvent(toggle, 'valueChange', true);
  expect(onChange).not.toHaveBeenCalled();
});
