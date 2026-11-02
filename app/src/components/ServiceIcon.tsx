import { Image } from 'expo-image';
import { Text, View } from 'react-native';

// Mirrors theme cat.1-cat.5; kept as values because the tile color is applied through style.
const PALETTE = ['#0B7A57', '#2F6FDB', '#E39B2B', '#7A5AE0', '#D2497A'] as const;

function hash(name: string): number {
  let h = 0;
  for (const char of name) h = (h * 31 + char.charCodeAt(0)) >>> 0;
  return h;
}

type Props = { service: { name: string; logo_url: string | null; color?: string | null }; size?: number };

export function ServiceIcon({ service, size = 40 }: Props) {
  const tile = { width: size, height: size, borderRadius: Math.round(size * 0.3) };

  if (service.logo_url) {
    return (
      <View testID="service-tile" style={{ ...tile, overflow: 'hidden' }}>
        <Image testID="service-logo" source={{ uri: service.logo_url }} style={{ width: size, height: size }} contentFit="cover" accessibilityIgnoresInvertColors />
      </View>
    );
  }

  const backgroundColor = service.color ?? PALETTE[hash(service.name) % PALETTE.length];
  return (
    <View testID="service-tile" style={{ ...tile, backgroundColor, alignItems: 'center', justifyContent: 'center' }}>
      <Text className="font-display" style={{ color: '#FFFFFF', fontSize: Math.round(size * 0.42) }}>
        {service.name.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}
