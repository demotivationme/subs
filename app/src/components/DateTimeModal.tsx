import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useEffect, useEffectEvent, useState } from 'react';
import { Modal, Platform, useColorScheme } from 'react-native';
import { useTranslation } from 'react-i18next';

import { isoToLocalDate, localDateToIso, localDateToTime, timeToLocalDate } from '@/lib/dates';

import { AppText } from './AppText';
import { Button } from './Button';
import { ModalBody } from './ModalBody';

export type DateTimeModalProps = {
  /** 'date' reads and writes YYYY-MM-DD; 'time' reads and writes HH:MM. */
  mode: 'date' | 'time';
  visible: boolean;
  title: string;
  /** Empty opens on `fallback`. */
  value: string;
  fallback: string;
  onSave: (value: string) => void;
  onClose: () => void;
};

const CONVERT = {
  date: { toDate: isoToLocalDate, fromDate: localDateToIso, display: 'inline' },
  time: { toDate: timeToLocalDate, fromDate: localDateToTime, display: 'spinner' },
} as const;
const THEME = { dark: { variant: 'dark', accent: '#34C08E' }, light: { variant: 'light', accent: '#0B7A57' } } as const;

/** Picks a billing date or a reminder time: the system dialog on Android, a sheet with the native picker on iOS. */
export function DateTimeModal({ mode, visible, title, value, fallback, onSave, onClose }: DateTimeModalProps) {
  const initial = value === '' ? fallback : value;

  // Android has no inline picker: open the system dialog once per opening and report back.
  const openAndroidDialog = useEffectEvent(() => {
    const { toDate, fromDate } = CONVERT[mode];
    DateTimePickerAndroid.open({
      value: toDate(initial),
      mode,
      onChange: (event, date) => (event.type === 'set' && date ? onSave(fromDate(date)) : onClose()),
    });
  });
  useEffect(() => {
    if (Platform.OS === 'android' && visible) openAndroidDialog();
  }, [visible]);

  if (Platform.OS === 'android') return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {visible ? <IosBody mode={mode} title={title} initial={initial} onSave={onSave} onClose={onClose} /> : null}
    </Modal>
  );
}

type BodyProps = { mode: DateTimeModalProps['mode']; title: string; initial: string; onSave: (value: string) => void; onClose: () => void };

function IosBody({ mode, title, initial, onSave, onClose }: BodyProps) {
  const { t } = useTranslation();
  const theme = THEME[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const { toDate, fromDate, display } = CONVERT[mode];
  const [draft, setDraft] = useState(initial);
  return (
    <ModalBody className="gap-4">
      <AppText variant="heading">{title}</AppText>
      <DateTimePicker
        testID="date-time-picker"
        value={toDate(draft)}
        mode={mode}
        display={display}
        themeVariant={theme.variant}
        accentColor={theme.accent}
        onChange={(_, date) => {
          if (date) setDraft(fromDate(date));
        }}
      />
      <Button label={t('common.done')} onPress={() => onSave(draft)} />
      <Button label={t('common.cancel')} variant="secondary" onPress={onClose} />
    </ModalBody>
  );
}
