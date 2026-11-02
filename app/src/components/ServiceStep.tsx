import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useServiceSearch } from '@/api/services';
import type { Service } from '@/api/types';
import { useDebounced } from '@/lib/useDebounced';

import { AppText } from './AppText';
import { ListRow } from './ListRow';
import { ServiceIcon } from './ServiceIcon';
import { StepFrame } from './StepFrame';
import { TextField } from './TextField';

const POPULAR_COUNT = 9;

type Props = {
  /** Picking a service goes straight on to the price step. */
  onPick: (service: Service) => void;
  onAddOwn: (name: string) => void;
};

/** Step 1: search the catalog or pick from the popular grid. */
export function ServiceStep({ onPick, onAddOwn }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const term = useDebounced(query.trim(), 300);
  const popular = useServiceSearch('');
  const search = useServiceSearch(term);

  const searching = query.trim() !== '';
  const results = searching ? (search.data ?? []) : [];
  const exact = results.some((s) => s.name.toLowerCase() === query.trim().toLowerCase());
  const tiles = (popular.data ?? []).filter((s) => !s.is_custom).slice(0, POPULAR_COUNT);

  return (
    <StepFrame>
      <AppText variant="title">{t('form.whatTitle')}</AppText>
      <TextField label={t('form.searchServices')} value={query} onChangeText={setQuery} autoCorrect={false} />

      {searching ? (
        <View>
          {results.map((s) => (
            <ListRow key={s.id} title={s.name} leading={<ServiceIcon service={s} />} onPress={() => onPick(s)} />
          ))}
          {term === query.trim() && !exact ? (
            <ListRow title={t('form.addOwnRow', { name: query.trim() })} onPress={() => onAddOwn(query.trim())} />
          ) : null}
        </View>
      ) : (
        <View className="gap-3">
          <AppText variant="muted" className="font-medium text-[13px]">{t('form.popular')}</AppText>
          <View className="flex-row flex-wrap gap-3">
            {tiles.map((s) => (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityLabel={s.name}
                onPress={() => onPick(s)}
                className="w-[30%] flex-grow items-center gap-2 rounded-tile bg-surface px-2 py-3.5 dark:bg-surface-dark">
                <ServiceIcon service={s} size={44} />
                <AppText className="text-[13px] font-medium" numberOfLines={1}>{s.name}</AppText>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('form.notListed')}
        onPress={() => onAddOwn(query.trim())}
        className="h-12 items-center justify-center rounded-xl border border-dashed border-line dark:border-line-dark">
        <AppText className="font-semibold text-accent dark:text-accent-dark">{t('form.notListed')}</AppText>
      </Pressable>
    </StepFrame>
  );
}
