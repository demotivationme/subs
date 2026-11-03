import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ServiceIcon } from '@/components/ServiceIcon';
import { cn } from '@/lib/cn';
import { prefs } from '@/lib/prefs';
import { useScheme } from '@/theme';

const LAST = 3;

// Illustration sample data: brand names and prices are demo content, not UI copy.
const DEMO = {
  netflix: { name: 'Netflix', price: '€12.99' },
  spotify: { name: 'Spotify', price: '€10.99' },
  icloud: { name: 'iCloud+', price: '€2.99' },
  adobe: { name: 'Adobe', price: '€19.99' },
  disney: { name: 'Disney+', initial: 'D' },
  total: '€46.96',
  nowTotal: '€37.97',
  saved: '−€8.99',
  amount: '10,99',
  currency: 'EUR',
} as const;
const PERIODS = ['week', 'month', 'year'] as const;
const TILT = { a: '-5deg', b: '4deg', c: '3deg', d: '-4deg' } as const;

/** Marks the first-run intro as done so the auth stack opens on log in from now on. */
function markSeen() {
  return prefs.set('onboarding.seen', '1');
}

const shadow = 'shadow-lg shadow-ink/10';

function Pill({ name, price, rotate, className }: { name: string; price: string; rotate: string; className: string }) {
  return (
    <View
      style={{ transform: [{ rotate }] }}
      className={cn('absolute flex-row items-center gap-2 rounded-full bg-surface py-2 pl-2 pr-3.5 dark:bg-surface-dark', shadow, className)}>
      <ServiceIcon service={{ name, logo_url: null }} size={28} />
      <AppText className="text-sm font-semibold">{name}</AppText>
      <AppText variant="muted" numeric>{price}</AppText>
    </View>
  );
}

function SlideOneArt() {
  const { t } = useTranslation();
  return (
    <View className="h-full w-full items-center justify-center">
      <Pill {...DEMO.netflix} rotate={TILT.a} className="left-8 top-10" />
      <Pill {...DEMO.spotify} rotate={TILT.b} className="right-6 top-24" />
      <Pill {...DEMO.icloud} rotate={TILT.c} className="bottom-14 left-12" />
      <Pill {...DEMO.adobe} rotate={TILT.d} className="bottom-8 right-9" />
      <View className="w-[250px] gap-1 rounded-[24px] bg-accent p-5 shadow-xl shadow-accent/30 dark:bg-accent-dark">
        <AppText className="text-[13px] font-medium text-surface dark:text-ground-dark">{t('onboarding.demo.perMonthLabel')}</AppText>
        <AppText numeric className="font-display text-[40px] text-surface dark:text-ground-dark">{DEMO.total}</AppText>
        <AppText numeric className="text-[13px] text-surface dark:text-ground-dark">{t('onboarding.demo.perYearLine')}</AppText>
      </View>
    </View>
  );
}

function SlideTwoArt({ dark }: { dark: boolean }) {
  const { t } = useTranslation();
  return (
    <View className={cn('w-[290px] gap-3 rounded-[24px] bg-surface p-[18px] dark:bg-surface-dark', shadow)}>
      <View className="h-11 flex-row items-center gap-2.5 rounded-xl border-[1.5px] border-accent px-3 dark:border-accent-dark">
        <Ionicons name="search" size={16} color={dark ? '#9AA3AF' : '#5B6370'} />
        <AppText className="text-[15px]">{t('onboarding.demo.search')}</AppText>
      </View>
      <View className="flex-row items-center gap-2.5 rounded-xl bg-accent-soft px-3 py-2.5 dark:bg-accent-soft-dark">
        <ServiceIcon service={{ name: DEMO.spotify.name, logo_url: null }} size={32} />
        <AppText className="flex-1 text-[15px] font-semibold">{DEMO.spotify.name}</AppText>
        <Ionicons name="checkmark" size={18} color={dark ? '#34C08E' : '#0B7A57'} />
      </View>
      <View className="flex-row gap-2">
        <View className="h-11 flex-1 justify-center rounded-xl border border-line px-3 dark:border-line-dark">
          <AppText numeric className="font-semibold">{DEMO.amount}</AppText>
        </View>
        <View className="h-11 w-[74px] items-center justify-center rounded-xl border border-line dark:border-line-dark">
          <AppText className="text-sm font-semibold">{DEMO.currency}</AppText>
        </View>
      </View>
      <View className="flex-row gap-[3px] rounded-[10px] bg-surface2 p-[3px] dark:bg-surface2-dark">
        {PERIODS.map((period) => (
          <View key={period} className={cn('flex-1 items-center rounded-lg py-[7px]', period === 'month' && 'bg-surface dark:bg-surface-dark')}>
            <AppText className={cn('text-[13px]', period === 'month' && 'font-semibold')}>{t(`onboarding.demo.${period}`)}</AppText>
          </View>
        ))}
      </View>
      <View className="h-11 items-center justify-center rounded-xl bg-accent dark:bg-accent-dark">
        <AppText className="text-[15px] font-semibold text-surface dark:text-ground-dark">{t('onboarding.demo.save')}</AppText>
      </View>
    </View>
  );
}

function Chip({ label, tone }: { label: string; tone: 'on' | 'off' | 'soft' }) {
  return (
    <View
      className={cn(
        'rounded-full px-3 py-[7px]',
        tone === 'on' && 'bg-ink dark:bg-ink-dark',
        tone === 'off' && 'border border-line dark:border-line-dark',
        tone === 'soft' && 'bg-accent-soft dark:bg-accent-soft-dark',
      )}>
      <AppText
        className={cn(
          'text-[13px]',
          tone === 'on' && 'font-medium text-surface dark:text-ground-dark',
          tone === 'off' && 'font-medium',
          tone === 'soft' && 'font-semibold text-accent-strong dark:text-accent-dark',
        )}>
        {label}
      </AppText>
    </View>
  );
}

function SlideThreeArt() {
  const { t } = useTranslation();
  return (
    <View className="items-center gap-[18px]">
      <View className={cn('w-[310px] flex-row gap-3 rounded-[20px] border border-line bg-surface px-4 py-3.5 dark:border-line-dark dark:bg-surface-dark', shadow)}>
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
      <View className={cn('w-[280px] gap-3 rounded-[20px] bg-surface p-4 dark:bg-surface-dark', shadow)}>
        <AppText variant="muted" className="text-[13px] font-semibold">{t('onboarding.demo.remindMe')}</AppText>
        <View className="flex-row flex-wrap gap-1.5">
          <Chip tone="on" label={t('onboarding.demo.oneDay')} />
          <Chip tone="on" label={t('onboarding.demo.sevenDays')} />
          <Chip tone="off" label={t('onboarding.demo.onDay')} />
        </View>
        <AppText variant="muted" className="text-[13px] font-semibold">{t('onboarding.demo.via')}</AppText>
        <View className="flex-row gap-1.5">
          <Chip tone="soft" label={t('onboarding.demo.push')} />
          <Chip tone="soft" label={t('onboarding.demo.inApp')} />
          <Chip tone="off" label={t('onboarding.demo.email')} />
        </View>
      </View>
    </View>
  );
}

function SlideFourArt() {
  const { t } = useTranslation();
  const row = 'flex-row items-center gap-2.5 rounded-2xl bg-surface px-3.5 py-3 dark:bg-surface-dark';
  return (
    <View className="w-[300px] gap-2.5">
      <View className="flex-row items-end justify-between rounded-[22px] bg-accent px-[18px] py-4 dark:bg-accent-dark">
        <View className="gap-0.5">
          <AppText className="text-xs text-surface dark:text-ground-dark">{t('onboarding.demo.nowPerMonth')}</AppText>
          <AppText numeric className="font-display text-[32px] text-surface dark:text-ground-dark">{DEMO.nowTotal}</AppText>
        </View>
        <View className="rounded-full bg-surface/20 px-2.5 py-[5px]">
          <AppText numeric className="text-[13px] font-semibold text-surface dark:text-ground-dark">{DEMO.saved}</AppText>
        </View>
      </View>
      <View className={row}>
        <ServiceIcon service={{ name: DEMO.netflix.name, logo_url: null }} size={32} />
        <AppText className="flex-1 text-[15px] font-semibold">{DEMO.netflix.name}</AppText>
        <AppText numeric className="font-semibold">{DEMO.netflix.price}</AppText>
      </View>
      <View className={row}>
        <ServiceIcon service={{ name: DEMO.spotify.name, logo_url: null }} size={32} />
        <AppText className="flex-1 text-[15px] font-semibold">{DEMO.spotify.name}</AppText>
        <AppText numeric className="font-semibold">{DEMO.spotify.price}</AppText>
      </View>
      <View className={cn(row, 'border-[1.5px] border-dashed border-line opacity-80 dark:border-line-dark')}>
        <View className="h-8 w-8 items-center justify-center rounded-[10px] bg-surface2 dark:bg-surface2-dark">
          <AppText variant="muted" className="font-heading">{DEMO.disney.initial}</AppText>
        </View>
        <AppText variant="muted" className="flex-1 text-[15px] font-semibold line-through">{DEMO.disney.name}</AppText>
        <View className="rounded-full bg-warn-soft px-[9px] py-[3px] dark:bg-warn-soft-dark">
          <AppText className="text-xs font-semibold text-warn-ink dark:text-warn-ink-dark">{t('onboarding.demo.cancelled')}</AppText>
        </View>
      </View>
    </View>
  );
}

function StepDots({ current }: { current: number }) {
  const { t } = useTranslation();
  return (
    <View accessibilityRole="image" accessibilityLabel={t('onboarding.step', { current: current + 1, total: LAST + 1 })} className="flex-row gap-1.5">
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          className={cn('h-2 rounded', i === current ? 'w-[22px] bg-accent dark:bg-accent-dark' : 'w-2 bg-line dark:bg-line-dark')}
        />
      ))}
    </View>
  );
}

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const dark = useScheme() === 'dark';
  const last = index === LAST;

  // Reaching the final slide counts as having seen the intro, even if the app is closed there.
  useEffect(() => {
    if (last) void markSeen();
  }, [last]);

  const finish = async (href: '/register' | '/login') => {
    await markSeen();
    router.replace(href);
  };

  const toRegister = () => void finish('/register');
  const toLogin = () => void finish('/login');
  const arts: ReactNode[] = [<SlideOneArt key={0} />, <SlideTwoArt key={1} dark={dark} />, <SlideThreeArt key={2} />, <SlideFourArt key={3} />];
  const iconColor = dark ? '#9AA3AF' : '#5B6370';

  return (
    <SafeAreaView className="flex-1 bg-ground dark:bg-ground-dark">
      <View className="h-14 flex-row items-start justify-between px-3 pt-4">
        {index > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.back')}
            onPress={() => setIndex(index - 1)}
            className="h-11 w-11 items-center justify-center">
            <Ionicons name="chevron-back" size={22} color={iconColor} />
          </Pressable>
        ) : (
          <View />
        )}
        {!last ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.skip')}
            onPress={() => setIndex(LAST)}
            className="min-h-11 justify-center px-3">
            <AppText variant="muted" className="text-[15px] font-semibold">{t('onboarding.skip')}</AppText>
          </Pressable>
        ) : null}
      </View>

      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="flex-1 items-center justify-center">
        {arts[index]}
      </View>

      <View className="gap-3 px-7">
        <AppText accessibilityRole="header" className="font-display text-[30px]">{t(`onboarding.slide${index + 1}Title`)}</AppText>
        <AppText variant="muted" className="text-base leading-6">{t(`onboarding.slide${index + 1}Body`)}</AppText>
      </View>

      {last ? (
        <View className="gap-1.5 px-6 pb-8 pt-7">
          <View className="mb-3.5 items-center">
            <StepDots current={index} />
          </View>
          <Button label={t('onboarding.getStarted')} onPress={toRegister} className="h-[54px]" />
          <Button label={t('onboarding.haveAccount')} variant="ghost" onPress={toLogin} />
        </View>
      ) : (
        <View className="flex-row items-center justify-between px-7 pb-9 pt-7">
          <StepDots current={index} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.next')}
            onPress={() => setIndex(index + 1)}
            className="h-[52px] flex-row items-center gap-2 rounded-[14px] bg-ink px-7 dark:bg-ink-dark">
            <AppText className="text-base font-semibold text-surface dark:text-ground-dark">{t('onboarding.next')}</AppText>
            <Ionicons name="arrow-forward" size={18} color={dark ? '#0E1013' : '#FFFFFF'} />
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
