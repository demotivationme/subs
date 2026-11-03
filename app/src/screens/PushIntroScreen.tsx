import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { enablePush, type PushResult } from '@/push';
import { markPushOffered } from '@/push/offer';

const MESSAGES: Record<Exclude<PushResult, 'enabled'>, string> = {
  denied: 'push.denied',
  unsupported: 'push.unsupported',
  failed: 'push.failed',
};

/** Sample reminder, same card as the onboarding illustration. */
function SampleNotification() {
  const { t } = useTranslation();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="w-[310px] flex-row gap-3 rounded-[20px] border border-line bg-surface px-4 py-3.5 shadow-lg shadow-ink/10 dark:border-line-dark dark:bg-surface-dark">
      <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-accent dark:bg-accent-dark">
        <Ionicons name="refresh" size={20} color="#FFFFFF" />
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row justify-between">
          <AppText className="text-[13px] font-semibold">{t('onboarding.demo.notifApp')}</AppText>
          <AppText variant="muted" className="text-xs">{t('onboarding.demo.notifNow')}</AppText>
        </View>
        <AppText className="text-[15px] font-bold">{t('onboarding.demo.notifTitle')}</AppText>
        <AppText variant="muted" numeric>{t('onboarding.demo.notifBody')}</AppText>
      </View>
    </View>
  );
}

export default function PushIntroScreen() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Exclude<PushResult, 'enabled'> | null>(null);

  const turnOn = async () => {
    setBusy(true);
    await markPushOffered();
    const outcome = await enablePush();
    setBusy(false);
    if (outcome === 'enabled') router.back();
    else setResult(outcome);
  };

  const later = async () => {
    await markPushOffered();
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark">
      <View className="flex-1 items-center justify-center">
        <SampleNotification />
      </View>
      <View className="gap-3 px-7">
        <AppText accessibilityRole="header" className="font-display text-[30px]">{t('push.introTitle')}</AppText>
        <AppText variant="muted" className="text-base leading-6">{t('push.introBody')}</AppText>
        {result ? <Banner tone="warning" message={t(MESSAGES[result])} /> : null}
      </View>
      <View className="gap-1.5 px-6 pb-8 pt-7">
        {result ? null : <Button label={t('push.enable')} onPress={() => void turnOn()} loading={busy} className="h-[54px]" />}
        <Button label={t('push.notNow')} variant="ghost" onPress={() => void later()} />
      </View>
    </SafeAreaView>
  );
}
