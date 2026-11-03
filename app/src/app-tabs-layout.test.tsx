import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/utils';

import TabsLayout from '@/app/(app)/(tabs)/_layout';

jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  const Tabs = ({ children }: { children: unknown }) => children;
  const Screen = ({ name, options }: { name: string; options: { title: string } }) => <Text testID={`tab-${name}`}>{options.title}</Text>;
  Screen.displayName = 'Screen';
  Tabs.Screen = Screen;
  return { Tabs };
});

test('the tab bar reads Home, Subscriptions, Stats, Settings in that order', async () => {
  await renderWithProviders(<TabsLayout />);
  const tabs = screen.getAllByTestId(/^tab-/);
  expect(tabs.map((tab) => tab.props.testID)).toEqual(['tab-index', 'tab-subscriptions', 'tab-stats', 'tab-settings']);
  expect(screen.getByText('Home')).toBeTruthy();
  expect(screen.getByText('Stats')).toBeTruthy();
});
