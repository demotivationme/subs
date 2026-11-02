import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { authApi } from '@/api/auth';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ErrorMessage } from '@/components/ErrorMessage';
import { FormTextField } from '@/components/FormTextField';
import { Screen } from '@/components/Screen';
import { TextLink } from '@/components/TextLink';

const schema = z.object({ email: z.email('validation.email') });

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [sent, setSent] = useState<string | null>(null);
  const [formError, setFormError] = useState<unknown>(null);
  const { control, handleSubmit, formState } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null);
    try {
      setSent((await authApi.forgotPassword(email)).message);
    } catch (error) {
      setFormError(error);
    }
  });

  const toLogin = () => router.replace('/login');

  return (
    <Screen>
      {sent ? <Banner message={sent} /> : null}
      <FormTextField control={control} name="email" label={t('auth.email')} autoCapitalize="none" keyboardType="email-address" />
      <ErrorMessage error={formError} />
      <Button label={t('auth.sendLink')} onPress={onSubmit} loading={formState.isSubmitting} />
      <TextLink label={t('auth.backToLogin')} onPress={toLogin} />
    </Screen>
  );
}
