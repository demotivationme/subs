import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { authApi } from '@/api/auth';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ErrorMessage } from '@/components/ErrorMessage';
import { FormTextField } from '@/components/FormTextField';
import { Screen } from '@/components/Screen';
import { applyServerErrors } from '@/lib/forms';

const schema = z.object({ password: z.string().min(8, 'validation.passwordMin') });

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { token, email } = useLocalSearchParams<{ token?: string; email?: string }>();
  const [done, setDone] = useState<string | null>(null);
  const [formError, setFormError] = useState<unknown>(null);
  const { control, handleSubmit, setError, formState } = useForm({ resolver: zodResolver(schema), defaultValues: { password: '' } });

  const toLogin = () => router.replace('/login');
  const backToLogin = <Button label={t('auth.backToLogin')} variant="secondary" onPress={toLogin} />;

  if (!token || !email) {
    return (
      <Screen>
        <AppText>{t('auth.invalidLink')}</AppText>
        {backToLogin}
      </Screen>
    );
  }

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      setDone((await authApi.resetPassword({ token, email, password })).message);
    } catch (error) {
      // An expired token comes back as an "email" error: show it as the form message.
      if (!applyServerErrors(error, setError, ['password'])) setFormError(error);
    }
  });

  return (
    <Screen>
      {done ? (
        <Banner message={done} />
      ) : (
        <>
          <FormTextField control={control} name="password" label={t('auth.newPassword')} secureTextEntry autoComplete="new-password" />
          <ErrorMessage error={formError} />
          <Button label={t('auth.resetPassword')} onPress={onSubmit} loading={formState.isSubmitting} />
        </>
      )}
      {backToLogin}
    </Screen>
  );
}
