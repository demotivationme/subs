import { useState } from 'react';
import { Modal, type KeyboardTypeOptions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from './AppText';
import { Button } from './Button';
import { ModalBody } from './ModalBody';
import { TextField } from './TextField';

type Props = {
  visible: boolean;
  title: string;
  label: string;
  value: string;
  onSave: (value: string) => void;
  onClose: () => void;
  keyboardType?: KeyboardTypeOptions;
};

function Body({ title, label, value, onSave, onClose, keyboardType }: Omit<Props, 'visible'>) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);
  return (
    <ModalBody className="gap-4">
      <AppText variant="heading">{title}</AppText>
      <TextField label={label} value={draft} onChangeText={setDraft} keyboardType={keyboardType} autoCorrect={false} autoCapitalize="none" autoFocus />
      <Button label={t('common.done')} onPress={() => onSave(draft.trim())} />
      <Button label={t('common.cancel')} variant="secondary" onPress={onClose} />
    </ModalBody>
  );
}

/** A small full-screen text prompt (billing date, reminder time). */
export function TextEntryModal({ visible, ...body }: Props) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={body.onClose}>
      {visible ? <Body {...body} /> : null}
    </Modal>
  );
}
