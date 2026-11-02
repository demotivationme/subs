import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { authApi } from '@/api/auth';
import { useMe } from '@/api/me';

import { Banner } from './Banner';

/** Email reminders only go to verified addresses (spec §7.4). */
export function VerifyEmailBanner() {
  const { t } = useTranslation();
  const me = useMe();
  const resend = useMutation({ mutationFn: authApi.resendVerification });

  if (!me.data || me.data.email_verified) return null;

  return resend.isSuccess ? (
    <Banner tone="warning" message={t('verify.sent')} />
  ) : (
    <Banner tone="warning" message={t('verify.banner')} action={{ label: t('verify.resend'), onPress: () => resend.mutate() }} />
  );
}
