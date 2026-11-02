import { useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from './AppText';
import { Button } from './Button';
import { TextField } from './TextField';

type Props<T extends string | number | null> = {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  searchable?: boolean;
  error?: string;
  /** Controlled open state, for screens that open the picker from their own button. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide the built-in trigger (use with `open`). */
  hideTrigger?: boolean;
};

export function SelectField<T extends string | number | null>({ label, value, options, onChange, searchable, error, open: openProp, onOpenChange, hideTrigger }: Props<T>) {
  const { t } = useTranslation();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value);
  const showSearch = searchable ?? options.length > 10;
  const visible = query ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : options;

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View className={hideTrigger ? undefined : 'gap-1'}>
      {hideTrigger ? null : (
        <>
          <AppText variant="muted" className="font-medium text-[13px]">{label}</AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => setOpen(true)}
            className="h-12 justify-center rounded-xl border border-line bg-surface px-3.5 dark:border-line-dark dark:bg-surface-dark">
            <AppText>{selected?.label ?? ''}</AppText>
          </Pressable>
        </>
      )}
      {error ? <AppText variant="error">{error}</AppText> : null}
      <Modal visible={open} animationType="slide" onRequestClose={close}>
        <View className="flex-1 gap-3 bg-ground p-4 pt-12 dark:bg-ground-dark">
          <AppText variant="heading">{label}</AppText>
          {showSearch ? <TextField label={t('common.search')} value={query} onChangeText={setQuery} autoFocus /> : null}
          <FlatList
            data={visible}
            keyExtractor={(o) => String(o.value)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => {
                  onChange(item.value);
                  close();
                }}
                className="border-b border-line py-3 dark:border-line-dark">
                <AppText className={item.value === value ? 'font-semibold' : undefined}>{item.label}</AppText>
              </Pressable>
            )}
          />
          <Button label={t('common.cancel')} variant="secondary" onPress={close} />
        </View>
      </Modal>
    </View>
  );
}
