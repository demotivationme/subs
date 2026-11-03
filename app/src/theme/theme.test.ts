import { renderHook } from '@testing-library/react-native';
import { colorScheme } from 'nativewind';

import { prefs } from '@/lib/prefs';

import { useScheme, useTheme } from './index';

beforeEach(async () => {
  await prefs.remove('theme');
  useTheme.setState({ preference: 'system', loaded: false });
});

test('defaults to the system theme when nothing is stored', async () => {
  const set = jest.spyOn(colorScheme, 'set');
  await useTheme.getState().hydrate();

  expect(useTheme.getState()).toMatchObject({ preference: 'system', loaded: true });
  expect(set).toHaveBeenCalledWith('system');
});

test('applies a stored choice on start', async () => {
  await prefs.set('theme', 'dark');
  await useTheme.getState().hydrate();

  expect(useTheme.getState().preference).toBe('dark');
  expect((await renderHook(() => useScheme())).result.current).toBe('dark');
});

test('ignores an unknown stored value', async () => {
  await prefs.set('theme', 'sepia');
  await useTheme.getState().hydrate();

  expect(useTheme.getState().preference).toBe('system');
});

test('choosing a theme applies and saves it', async () => {
  await useTheme.getState().choose('light');

  expect(useTheme.getState().preference).toBe('light');
  expect(await prefs.get('theme')).toBe('light');
  expect((await renderHook(() => useScheme())).result.current).toBe('light');
});
