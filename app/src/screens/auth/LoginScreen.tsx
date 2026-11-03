import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { z } from 'zod';

import { authApi } from '@/api/auth';
import { keys } from '@/api/keys';
import { useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ErrorMessage } from '@/components/ErrorMessage';
import { FormTextField } from '@/components/FormTextField';
import { Screen } from '@/components/Screen';
import { TextLink } from '@/components/TextLink';
import { deviceName } from '@/lib/device';
import { applyServerErrors } from '@/lib/forms';

const schema = z.object({
  email: z.email('validation.email'),
  password: z.string().min(1, 'validation.required'),
});

type Values = z.infer<typeof schema>;

export default function LoginScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [formError, setFormError] = useState<unknown>(null);
  const { control, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { token, user } = await authApi.login({ ...values, device_name: deviceName() });
      qc.setQueryData(keys.me, user);
      await useSession.getState().signIn(token);
    } catch (error) {
      if (!applyServerErrors(error, setError, ['email', 'password'])) setFormError(error);
    }
  });

  const toForgot = () => router.push('/forgot-password');
  const toRegister = () => router.push('/register');

  return (
    <Screen>
      <View className="gap-4 px-2 pt-12">
        <View className="h-14 w-14 items-center justify-center rounded-[18px] bg-accent dark:bg-accent-dark">
          <Ionicons name="refresh" size={28} color="#FFFFFF" />
        </View>
        <AppText accessibilityRole="header" className="font-display text-[32px]">{t('auth.loginHeadline')}</AppText>
        <AppText variant="muted" className="text-base leading-6">{t('auth.loginSubtitle')}</AppText>
      </View>
      <View className="gap-4 px-2 pt-4">
        <FormTextField control={control} name="email" label={t('auth.email')} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
        <FormTextField control={control} name="password" label={t('auth.password')} secureTextEntry autoComplete="current-password" />
        <ErrorMessage error={formError} />
        <Button label={t('auth.login')} onPress={onSubmit} loading={formState.isSubmitting} className="h-[52px]" />
        <View className="items-center">
          <TextLink label={t('auth.forgot')} onPress={toForgot} />
        </View>
      </View>
      <View className="items-center pt-4">
        <TextLink label={t('auth.noAccount')} onPress={toRegister} />
      </View>
    </Screen>
  );
}
