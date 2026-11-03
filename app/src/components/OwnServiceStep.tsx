import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/api/errors';
import { useCreateService, useUpdateService, useUploadServiceLogo } from '@/api/services';
import type { Service } from '@/api/types';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/errors';

import { AppText } from './AppText';
import { Button } from './Button';
import { ServiceIcon } from './ServiceIcon';
import { StepFrame } from './StepFrame';
import { TextField } from './TextField';

// Letter-tile colors from the design (cat.1 first); applied through style, so values not classes.
const SWATCHES = ['#0B7A57', '#2F5BD3', '#6D4ED8', '#C23A6E', '#C2410C', '#3A414B'] as const;

type Props = { initialName: string; onDone: (service: Service, notice?: string) => void };

/** Step 1b: create the user's own service with a color or an uploaded image. */
export function OwnServiceStep({ initialName, onDone }: Props) {
  const { t } = useTranslation();
  const createService = useCreateService();
  const updateService = useUpdateService();
  const uploadLogo = useUploadServiceLogo();
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<string>(SWATCHES[0]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [created, setCreated] = useState<{ service: Service; name: string; color: string } | null>(null);
  const [uploadFailed, setUploadFailed] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setUploadFailed(false);
      setError(null);
    }
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (trimmed === '') {
      setNameError(t('validation.serviceRequired'));
      return;
    }
    setNameError(undefined);
    setError(null);
    setBusy(true);
    try {
      // Once created in this step, edits PATCH that service instead of creating a second one.
      let service: Service;
      if (created) {
        service =
          created.name === trimmed && created.color === color
            ? created.service
            : await updateService.mutateAsync({ id: created.service.id, name: trimmed, color });
      } else {
        const result = await createService.mutateAsync({ name: trimmed, color });
        service = result.service;
        if (result.existing) {
          // A catalog or already-owned service with this name: use it as is, never restyle it.
          onDone(service, t(service.is_custom ? 'form.alreadyOwn' : 'form.alreadyInCatalog', { name: service.name }));
          return;
        }
      }
      setCreated({ service, name: trimmed, color });
      if (imageUri && !uploadFailed) {
        try {
          service = await uploadLogo.mutateAsync({ id: service.id, uri: imageUri });
        } catch (uploadError) {
          // The service exists; the user may continue with the letter tile.
          setUploadFailed(true);
          setError(uploadError);
          return;
        }
      }
      onDone(service);
    } catch (createError) {
      const nameMessage = createError instanceof ApiError && createError.status === 422 ? createError.errors.name?.[0] : undefined;
      if (nameMessage) setNameError(nameMessage);
      else setError(createError);
    } finally {
      setBusy(false);
    }
  };

  const trimmedName = name.trim();
  return (
    <StepFrame footer={<Button label={t('form.continue')} onPress={submit} loading={busy} />}>
      <AppText variant="title">{t('form.ownTitle')}</AppText>
      <AppText variant="muted">{trimmedName ? t('form.ownIntro', { name: trimmedName }) : t('form.ownIntroEmpty')}</AppText>

      <View className="items-center">
        <ServiceIcon service={{ name: trimmedName || '?', logo_url: imageUri, color }} size={72} />
      </View>

      <TextField label={t('form.name')} value={name} onChangeText={setName} error={nameError} />

      <View className="gap-2">
        <AppText variant="muted" className="font-medium text-[13px]">{t('form.icon')}</AppText>
        <Button label={t('form.uploadImage')} variant="secondary" onPress={pickImage} />
        <AppText variant="muted">{t('form.pickColor')}</AppText>
        <View className="flex-row flex-wrap gap-3">
          {SWATCHES.map((swatch, i) => (
            <Pressable
              key={swatch}
              accessibilityRole="radio"
              accessibilityLabel={t('form.swatch', { n: i + 1 })}
              accessibilityState={{ selected: color === swatch }}
              onPress={() => setColor(swatch)}
              style={{ backgroundColor: swatch }}
              className={cn('h-11 w-11 rounded-full border-2', color === swatch ? 'border-ink dark:border-ink-dark' : 'border-transparent')}
            />
          ))}
        </View>
      </View>

      {uploadFailed ? <AppText variant="error" accessibilityRole="alert">{t('form.uploadFailed')}</AppText> : error ? <AppText variant="error" accessibilityRole="alert">{errorMessage(error)}</AppText> : null}
      <AppText variant="muted" className="text-[13px]">{t('form.ownPrivate')}</AppText>
    </StepFrame>
  );
}
