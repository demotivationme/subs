import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, useColorScheme, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useCategories } from '@/api/categories';
import { useMe } from '@/api/me';
import { remindersApi, useReminderDefaults } from '@/api/reminders';
import { useCreateSubscription } from '@/api/subscriptions';
import type { Service } from '@/api/types';
import { useOnline } from '@/api/useOnline';
import { Button } from '@/components/Button';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Loading } from '@/components/Loading';
import { OfflineBanner } from '@/components/OfflineBanner';
import { OwnServiceStep } from '@/components/OwnServiceStep';
import { ProgressSteps } from '@/components/ProgressSteps';
import { ServiceStep } from '@/components/ServiceStep';
import { StepFrame } from '@/components/StepFrame';
import { SubscriptionPriceStep } from '@/components/SubscriptionPriceStep';
import { SubscriptionReminderStep, type ReminderValue } from '@/components/SubscriptionReminderStep';
import { hasRuleErrors, validateRules, type RuleErrors } from '@/features/reminders/rules';
import {
  defaultFormValues,
  serverFieldErrors,
  toPayload,
  validateForm,
  type FieldErrors,
  type SubscriptionFormValues,
} from '@/features/subscriptions/schema';
import { useLocale } from '@/i18n/useLocale';
import { formatDate, todayIso } from '@/lib/dates';
import { formatMoney, parseMoney } from '@/lib/money';
import { shouldOfferPush } from '@/push/offer';

type Step = 'service' | 'own' | 'price' | 'reminders';
const PROGRESS: Record<Step, number> = { service: 1, own: 1, price: 2, reminders: 3 };
const STEP_BEFORE: Partial<Record<Step, Step>> = { own: 'service', price: 'service', reminders: 'price' };

export default function NewSubscriptionScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const online = useOnline();
  const iconColor = useColorScheme() === 'dark' ? '#F1F3F5' : '#14171C';
  const me = useMe();
  const categories = useCategories();
  const defaults = useReminderDefaults();
  const create = useCreateSubscription();

  const [step, setStep] = useState<Step>('service');
  const [ownName, setOwnName] = useState('');
  const [service, setService] = useState<Service | null>(null);
  const [values, setValues] = useState<SubscriptionFormValues | null>(null);
  const [reminders, setReminders] = useState<ReminderValue>({ enabled: true, custom: null });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [ruleErrors, setRuleErrors] = useState<RuleErrors[]>([]);
  const [formError, setFormError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const categoryTouched = useRef(false);
  const createdId = useRef<number | null>(null);

  if (!me.data || !categories.data) return <Loading />;
  const user = me.data;
  const today = todayIso(user.timezone);
  const form = values ?? defaultFormValues(user.currency, today);

  const patch = (next: Partial<SubscriptionFormValues>) => {
    if ('categoryId' in next) categoryTouched.current = true;
    setValues({ ...form, ...next });
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !(key in next))));
  };

  const pick = (picked: Service) => {
    setService(picked);
    setValues({
      ...form,
      serviceId: picked.id,
      serviceName: picked.name,
      categoryId: categoryTouched.current ? form.categoryId : picked.default_category_id,
    });
    setErrors({});
    setStep('price');
  };

  const addOwn = (name: string) => {
    setOwnName(name);
    setStep('own');
  };
  const changeService = () => setStep('service');

  const goNext = () => {
    const found = validateForm(form);
    setErrors(found);
    if (Object.keys(found).length === 0) setStep('reminders');
  };

  const save = async () => {
    if (reminders.enabled && reminders.custom) {
      const found = validateRules(reminders.custom);
      setRuleErrors(found);
      if (hasRuleErrors(found)) return;
    }
    const found = validateForm(form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setStep(found.serviceName ? 'service' : 'price');
      return;
    }

    setFormError(null);
    setSaving(true);
    try {
      // A retry after a failed reminders PUT must not create the subscription twice.
      if (createdId.current === null) {
        createdId.current = (await create.mutateAsync({ ...toPayload(form), reminders_enabled: reminders.enabled })).id;
      }
      if (reminders.enabled && reminders.custom) await remindersApi.replaceForSubscription(createdId.current, reminders.custom);

      if (await shouldOfferPush()) router.replace('/push-intro');
      else router.back();
    } catch (error) {
      const fields = serverFieldErrors(error);
      if (fields) {
        setErrors(fields);
        setStep(fields.serviceName ? 'service' : 'price');
      } else {
        setFormError(error);
      }
    } finally {
      setSaving(false);
    }
  };

  const minor = parseMoney(form.amount, form.currency);
  const summary =
    service && minor !== null
      ? t('form.summaryLine', {
          service: service.name,
          amount: formatMoney(minor, form.currency, locale),
          period: t(`period.${form.period}`, { count: Number(form.intervalCount) || 1 }),
          date: formatDate(form.firstPaymentDate, locale),
        })
      : undefined;

  const back = STEP_BEFORE[step];
  return (
    <View className="flex-1 bg-ground pt-4 dark:bg-ground-dark">
      <View className="gap-3 px-4 pb-2">
        <View className="h-11 flex-row items-center justify-between">
          {back ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => setStep(back)} hitSlop={8} className="h-11 w-11 justify-center">
              <Ionicons name="chevron-back" size={24} color={iconColor} />
            </Pressable>
          ) : (
            <View className="h-11 w-11" />
          )}
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={() => router.back()} hitSlop={8} className="h-11 w-11 items-end justify-center">
            <Ionicons name="close" size={24} color={iconColor} />
          </Pressable>
        </View>
        <ProgressSteps count={3} current={PROGRESS[step]} />
        <OfflineBanner />
      </View>

      {step === 'service' ? <ServiceStep onPick={pick} onAddOwn={addOwn} /> : null}
      {step === 'own' ? <OwnServiceStep initialName={ownName} onDone={pick} /> : null}
      {step === 'price' ? (
        <StepFrame footer={<Button label={t('form.continue')} onPress={goNext} />}>
          <SubscriptionPriceStep
            value={form}
            onChange={patch}
            errors={errors}
            categories={categories.data}
            today={today}
            service={service ?? undefined}
            onChangeService={changeService}
          />
        </StepFrame>
      ) : null}
      {step === 'reminders' ? (
        <StepFrame
          footer={
            <View className="gap-3">
              <ErrorMessage error={formError} />
              <Button label={t('form.create')} onPress={save} loading={saving} disabled={!online} />
            </View>
          }>
          <SubscriptionReminderStep
            value={reminders}
            onChange={setReminders}
            defaults={defaults.data ?? []}
            errors={ruleErrors}
            email={user.email}
            paymentDate={form.firstPaymentDate}
            today={today}
            summary={summary}
          />
        </StepFrame>
      ) : null}
    </View>
  );
}
