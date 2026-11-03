import { createElement, useState } from 'react';
import { Modal } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useScheme } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import type { DateTimeModalProps } from './DateTimeModal';
import { ModalBody } from './ModalBody';

const INPUT = 'input';
const BASE = { height: 48, padding: '0 14px', fontSize: 16, borderRadius: 12 } as const;
const INPUT_STYLE = {
  light: { ...BASE, border: '1px solid #E3E6EA', background: '#FFFFFF', color: '#14171C', colorScheme: 'light' },
  dark: { ...BASE, border: '1px solid #2A2F37', background: '#171A1F', color: '#F1F3F5', colorScheme: 'dark' },
} as const;

/** Web: the browser's own date or time input (both use our YYYY-MM-DD / HH:MM formats) in the same sheet. */
export function DateTimeModal({ mode, visible, title, value, fallback, onSave, onClose }: DateTimeModalProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {visible ? <Body mode={mode} title={title} initial={value === '' ? fallback : value} onSave={onSave} onClose={onClose} /> : null}
    </Modal>
  );
}

type BodyProps = { mode: DateTimeModalProps['mode']; title: string; initial: string; onSave: (value: string) => void; onClose: () => void };

function Body({ mode, title, initial, onSave, onClose }: BodyProps) {
  const { t } = useTranslation();
  const inputStyle = useScheme() === 'dark' ? INPUT_STYLE.dark : INPUT_STYLE.light;
  const [draft, setDraft] = useState(initial);
  return (
    <ModalBody className="gap-4">
      <AppText variant="heading">{title}</AppText>
      {createElement(INPUT, {
        type: mode,
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
