import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { useColorScheme, View } from 'react-native';

import { HeaderAddButton } from '@/components/HeaderAddButton';
import { HeaderBell } from '@/components/HeaderBell';

// Navigation chrome takes raw values; they mirror the tokens in tailwind.config.js.
const THEME = {
  light: { ground: '#F5F6F8', surface: '#FFFFFF', line: '#E3E6EA', ink: '#14171C', muted: '#5B6370', accent: '#0B7A57' },
  dark: { ground: '#0E1013', surface: '#171A1F', line: '#2A2F37', ink: '#F1F3F5', muted: '#9AA3AF', accent: '#34C08E' },
};

type ScreenOptions = NonNullable<ComponentProps<typeof Tabs>['screenOptions']>;

const ICON = 'pie-chart-outline';

export default function TabsLayout() {
  const { t } = useTranslation();
  const c = THEME[useColorScheme() === 'dark' ? 'dark' : 'light'];

  const screenOptions: ScreenOptions = {
        headerRight: () => <HeaderBell />,
        headerRightContainerStyle: { paddingRight: 20 },
        headerTitleAlign: 'left',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: c.ground },
        headerTitleStyle: { fontFamily: 'Manrope_700Bold', fontSize: 28, color: c.ink },
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 11 },
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line },
      };

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.dashboard'),
          tabBarIcon: ({ color, size }) => <Ionicons name={ICON} color={String(color)} size={size} />,
        }}
      />
      <Tabs.Screen
        name="subscriptions"
        options={{
          title: t('tabs.subscriptions'),
          headerRight: () => (
            <View className="flex-row items-center gap-2">
              <HeaderAddButton />
              <HeaderBell />
            </View>
          ),
          tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" color={String(color)} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={String(color)} size={size} />,
        }}
      />
    </Tabs>
  );
}
