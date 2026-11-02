import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from '@/api/categories';
import type { Category } from '@/api/types';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Group } from '@/components/Group';
import { ListRow } from '@/components/ListRow';
import { Loading } from '@/components/Loading';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';

// Same order as the `cat` tokens in tailwind.config.js; used when a category has no color of its own.
const PALETTE = ['#0B7A57', '#2F6FDB', '#E39B2B', '#7A5AE0', '#D2497A'];

function Dot({ category }: { category: Category }) {
  const color = category.color ?? PALETTE[category.id % PALETTE.length];
  return <View className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />;
}

function CustomCategoryRow({ category }: { category: Category }) {
  const { t } = useTranslation();
  const rename = useUpdateCategory();
  const remove = useDeleteCategory();
  const [name, setName] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  if (name !== null) {
    return (
      <View className="gap-2 border-b border-line py-3 dark:border-line-dark">
        <TextField label={t('categories.name')} value={name} onChangeText={setName} autoFocus />
        <View className="flex-row gap-2">
          <Button
            className="flex-1"
            label={t('common.save')}
            loading={rename.isPending}
            disabled={name.trim() === ''}
            onPress={() => rename.mutate({ id: category.id, name: name.trim() }, { onSuccess: () => setName(null) })}
          />
          <Button className="flex-1" label={t('common.cancel')} variant="secondary" disabled={rename.isPending} onPress={() => setName(null)} />
        </View>
        <ErrorMessage error={rename.error} />
      </View>
    );
  }

  return (
    <View>
      <ListRow
        title={category.label}
        leading={<Dot category={category} />}
        right={
          <View className="flex-row items-center">
            <Button
              className="h-10 px-3"
              label={t('categories.rename')}
              variant="ghost"
              disabled={remove.isPending}
              onPress={() => setName(category.label)}
            />
            <Button
              className="h-10 px-3"
              label={confirm ? t('common.confirmDelete') : t('common.delete')}
              variant="ghostDanger"
              loading={remove.isPending}
              onPress={() => {
                if (!confirm) return setConfirm(true);
                remove.mutate(category.id, { onError: () => setConfirm(false) });
              }}
            />
          </View>
        }
      />
      <ErrorMessage error={remove.error} />
    </View>
  );
}

export default function CategoriesScreen() {
  const { t } = useTranslation();
  const categories = useCategories();
  const create = useCreateCategory();
  const [name, setName] = useState('');

  if (!categories.data) {
    return categories.isError ? (
      <Screen>
        <ErrorMessage error={categories.error} />
      </Screen>
    ) : (
      <Loading />
    );
  }

  const custom = categories.data.filter((c) => c.is_custom);
  const presets = categories.data.filter((c) => !c.is_custom);

  return (
    <Screen>
      <Group title={t('categories.custom')}>
        {custom.length === 0 ? <AppText variant="muted" className="py-3">{t('categories.noCustom')}</AppText> : null}
        {custom.map((c) => (
          <CustomCategoryRow key={c.id} category={c} />
        ))}
        <View className="gap-2 py-3">
          <TextField label={t('categories.add')} value={name} onChangeText={setName} />
          <Button
            label={t('common.add')}
            loading={create.isPending}
            disabled={name.trim() === ''}
            onPress={() => create.mutate({ name: name.trim() }, { onSuccess: () => setName('') })}
          />
          <ErrorMessage error={create.error} />
        </View>
      </Group>

      <Group title={t('categories.presets')}>
        {presets.map((c) => (
          <ListRow key={c.id} title={c.label} leading={<Dot category={c} />} />
        ))}
      </Group>
    </Screen>
  );
}
