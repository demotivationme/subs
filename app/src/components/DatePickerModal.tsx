import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useEffect, useEffectEvent, useState } from 'react';
import { Modal, Platform, useColorScheme } from 'react-native';
import { useTranslation } from 'react-i18next';

import { isoToLocalDate, localDateToIso } from '@/lib/dates';

import { AppText } from './AppText';
import { Button } from './Button';
import { ModalBody } from './ModalBody';

export type DatePickerModalProps = {
  visible: boolean;
  title: string;
  /** YYYY-MM-DD; empty opens on `fallback`. */
  value: string;
  fallback: string;
  onSave: (value: string) => void;
  onClose: () => void;
};

const DATE = 'date';
const INLINE = 'inline';
const THEME = { dark: { variant: 'dark', accent: '#34C08E' }, light: { variant: 'light', accent: '#0B7A57' } } as const;

/** Picks a billing date: the system dialog on Android, an inline calendar sheet on iOS. */
export function DatePickerModal({ visible, title, value, fallback, onSave, onClose }: DatePickerModalProps) {
  const initial = value === '' ? fallback : value;

  // Android has no inline picker: open the system dialog once per opening and report back.
  const openAndroidDialog = useEffectEvent(() => {
    DateTimePickerAndroid.open({
      value: isoToLocalDate(initial),
      mode: DATE,
      onChange: (event, date) => (event.type === 'set' && date ? onSave(localDateToIso(date)) : onClose()),
    });
  });
  useEffect(() => {
    if (Platform.OS === 'android' && visible) openAndroidDialog();
  }, [visible]);

  if (Platform.OS === 'android') return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {visible ? <IosBody title={title} initial={initial} onSave={onSave} onClose={onClose} /> : null}
    </Modal>
  );
}

function IosBody({ title, initial, onSave, onClose }: { title: string; initial: string; onSave: (value: string) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const theme = THEME[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [draft, setDraft] = useState(initial);
  return (
    <ModalBody className="gap-4">
      <AppText variant="heading">{title}</AppText>
      <DateTimePicker
        testID="date-picker"
        value={isoToLocalDate(draft)}
        mode={DATE}
        display={INLINE}
        themeVariant={theme.variant}
        accentColor={theme.accent}
        onChange={(_, date) => {
          if (date) setDraft(localDateToIso(date));
        }}
      />
      <Button label={t('common.done')} onPress={() => onSave(draft)} />
      <Button label={t('common.cancel')} variant="secondary" onPress={onClose} />
    </ModalBody>
  );
}
