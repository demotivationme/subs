import { Switch, useColorScheme, View } from 'react-native';

import { AppText } from './AppText';

type Props = { label: string; description?: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean };

export function SwitchRow({ label, description, value, onChange, disabled = false }: Props) {
  const dark = useColorScheme() === 'dark';
  return (
    <View className="min-h-12 flex-row items-center gap-3 py-2">
      <View className="flex-1 gap-0.5">
        <AppText className="font-medium">{label}</AppText>
        {description ? <AppText variant="muted">{description}</AppText> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        accessibilityState={{ disabled }}
        onValueChange={disabled ? undefined : onChange}
        trackColor={{ true: dark ? '#34C08E' : '#0B7A57' }}
      />
    </View>
  );
}
