import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View, useColorScheme } from 'react-native';
import { z } from 'zod';

import { authApi } from '@/api/auth';
import { keys } from '@/api/keys';
import { useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ErrorMessage } from '@/components/ErrorMessage';
import { FormTextField } from '@/components/FormTextField';
import { Screen } from '@/components/Screen';
import { SelectField } from '@/components/SelectField';
import { TextLink } from '@/components/TextLink';
import { deviceLocale } from '@/i18n';
import { currencyOptions, defaultCurrency } from '@/lib/currencies';
import { deviceTimeZone } from '@/lib/dates';
import { deviceName } from '@/lib/device';
import { translateError } from '@/lib/errors';
import { applyServerErrors } from '@/lib/forms';

const schema = z.object({
  name: z.string().trim().min(1, 'validation.required').max(255),
  email: z.email('validation.email'),
  password: z.string().min(8, 'validation.passwordMin'),
  currency: z.string().regex(/^[A-Z]{3}$/, 'validation.currency'),
});

type Values = z.infer<typeof schema>;

export default function RegisterScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const dark = useColorScheme() === 'dark';
  const [formError, setFormError] = useState<unknown>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [pickingCurrency, setPickingCurrency] = useState(false);
  const timezone = deviceTimeZone();
  const { control, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', currency: defaultCurrency() },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { token, user } = await authApi.register({
        ...values,
        timezone,
        locale: deviceLocale(),
        device_name: deviceName(),
      });
      qc.setQueryData(keys.me, user);
      await useSession.getState().signIn(token);
    } catch (error) {
      if (!applyServerErrors(error, setError, ['name', 'email', 'password', 'currency'])) setFormError(error);
      return;
    }
    // The first subscription is the next step.
    router.replace('/subscriptions/new');
  });

  const toWelcome = () => router.replace('/welcome');
  const toLogin = () => router.replace('/login');

  return (
    <Screen>
      <View className="-ml-1 h-11 w-11 justify-center">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={toWelcome}
          className="h-11 w-11 items-center justify-center">
          <Ionicons name="chevron-back" size={22} color={dark ? '#9AA3AF' : '#5B6370'} />
        </Pressable>
      </View>
      <View className="gap-2 px-2">
        <AppText accessibilityRole="header" className="font-display text-[30px] leading-[35px]">{t('auth.createTitle')}</AppText>
        <AppText variant="muted" className="text-base leading-6">{t('auth.createSubtitle')}</AppText>
      </View>
      <View className="gap-4 px-2 pt-2">
        <FormTextField control={control} name="name" label={t('auth.name')} autoComplete="name" />
        <FormTextField control={control} name="email" label={t('auth.email')} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
        <FormTextField
          control={control}
          name="password"
          label={t('auth.password')}
          hint={t('auth.passwordHint')}
          secureTextEntry={!showPassword}
          autoComplete="new-password"
          trailing={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              onPress={() => setShowPassword((v) => !v)}
              className="h-11 w-11 items-center justify-center">
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={dark ? '#9AA3AF' : '#5B6370'} />
            </Pressable>
          }
        />
        <Controller
          control={control}
          name="currency"
          render={({ field, fieldState }) => (
            <View className="gap-1">
              <View className="flex-row items-center justify-between gap-3 rounded-[14px] bg-surface px-3.5 py-3 dark:bg-surface-dark">
                <View className="gap-0.5">
                  <AppText variant="muted" className="text-[13px]">{t('auth.totalsIn')}</AppText>
                  <AppText className="font-semibold">{`${field.value} · ${timezone}`}</AppText>
                </View>
                <Button label={t('auth.change')} variant="ghost" onPress={() => setPickingCurrency(true)} className="h-9 px-1" />
              </View>
              {fieldState.error ? <AppText variant="error">{translateError(fieldState.error.message)}</AppText> : null}
              <SelectField
                hideTrigger
                label={t('auth.currency')}
                value={field.value}
                options={currencyOptions(field.value)}
                onChange={field.onChange}
                open={pickingCurrency}
                onOpenChange={setPickingCurrency}
              />
            </View>
          )}
        />
        <ErrorMessage error={formError} />
        <Button label={t('auth.register')} onPress={onSubmit} loading={formState.isSubmitting} className="mt-1 h-[54px]" />
      </View>
      <View className="items-center">
        <TextLink label={t('auth.haveAccount')} onPress={toLogin} />
      </View>
    </Screen>
  );
}
