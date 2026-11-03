import { createElement, useState } from 'react';
import { Modal, useColorScheme } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from './AppText';
import { Button } from './Button';
import type { DatePickerModalProps } from './DatePickerModal';
import { ModalBody } from './ModalBody';

const INPUT = 'input';
const DATE = 'date';
const BASE = { height: 48, padding: '0 14px', fontSize: 16, borderRadius: 12 } as const;
const INPUT_STYLE = {
  light: { ...BASE, border: '1px solid #E3E6EA', background: '#FFFFFF', color: '#14171C', colorScheme: 'light' },
  dark: { ...BASE, border: '1px solid #2A2F37', background: '#171A1F', color: '#F1F3F5', colorScheme: 'dark' },
} as const;

/** Web: the browser's own date input in the same sheet as the native pickers. */
export function DatePickerModal({ visible, title, value, fallback, onSave, onClose }: DatePickerModalProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {visible ? <Body title={title} initial={value === '' ? fallback : value} onSave={onSave} onClose={onClose} /> : null}
    </Modal>
  );
}

function Body({ title, initial, onSave, onClose }: { title: string; initial: string; onSave: (value: string) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const inputStyle = useColorScheme() === 'dark' ? INPUT_STYLE.dark : INPUT_STYLE.light;
  const [draft, setDraft] = useState(initial);
  return (
    <ModalBody className="gap-4">
      <AppText variant="heading">{title}</AppText>
      {createElement(INPUT, {
        type: DATE,
        value: draft,
        'aria-label': title,
        onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
        style: inputStyle,
      })}
      <Button label={t('common.done')} disabled={draft === ''} onPress={() => onSave(draft)} />
      <Button label={t('common.cancel')} variant="secondary" onPress={onClose} />
    </ModalBody>
  );
}
