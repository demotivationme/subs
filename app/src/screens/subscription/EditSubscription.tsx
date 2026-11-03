import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useCategories } from '@/api/categories';
import { useMe } from '@/api/me';
import { useReminderDefaults, useSubscriptionRules, useUpdateSubscriptionRules } from '@/api/reminders';
import { useUpdateSubscription } from '@/api/subscriptions';
import type { Subscription } from '@/api/types';
import { useOnline } from '@/api/useOnline';
import { Button } from '@/components/Button';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Loading } from '@/components/Loading';
import { StepFrame } from '@/components/StepFrame';
import { SubscriptionPriceStep } from '@/components/SubscriptionPriceStep';
import { SubscriptionReminderStep, type ReminderValue } from '@/components/SubscriptionReminderStep';
import { hasRuleErrors, toRuleInputs, validateRules, type RuleErrors } from '@/features/reminders/rules';
import {
  serverFieldErrors,
  toFormValues,
  toPayload,
  validateForm,
  type FieldErrors,
  type SubscriptionFormValues,
} from '@/features/subscriptions/schema';
import { todayIso } from '@/lib/dates';

const PRICE = 'price';
const REMINDERS = 'reminders';

type Props = { subscription: Subscription; onDone: () => void };

/** Steps 2 and 3 of the add flow, prefilled from the subscription, saving with PATCH (and PUT when the rules are custom). */
export function EditSubscription({ subscription, onDone }: Props) {
  const { t } = useTranslation();
  const online = useOnline();
  const me = useMe();
  const categories = useCategories();
  const rules = useSubscriptionRules(subscription.id);
  const defaults = useReminderDefaults();
  const update = useUpdateSubscription(subscription.id);
  const replaceRules = useUpdateSubscriptionRules(subscription.id);

  const [step, setStep] = useState<typeof PRICE | typeof REMINDERS>(PRICE);
  const [values, setValues] = useState<SubscriptionFormValues>(() => toFormValues(subscription));
  const [reminders, setReminders] = useState<ReminderValue | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [ruleErrors, setRuleErrors] = useState<RuleErrors[]>([]);
  const [formError, setFormError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  if (!me.data || !categories.data || !rules.data) {
    if (rules.isError || categories.isError || me.isError) return <ErrorMessage error={rules.error ?? categories.error ?? me.error} />;
    return <Loading />;
  }
  const user = me.data;
  const today = todayIso(user.timezone);
  const usesOwnRules = !rules.data.usesDefaults;
  const reminderValue: ReminderValue = reminders ?? {
    enabled: subscription.reminders_enabled,
    custom: usesOwnRules ? toRuleInputs(rules.data.rules) : null,
  };

  const patch = (next: Partial<SubscriptionFormValues>) => {
    setValues({ ...values, ...next });
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !(key in next))));
  };

  const goNext = () => {
    const found = validateForm(values);
    setErrors(found);
    if (Object.keys(found).length === 0) setStep(REMINDERS);
  };

  const save = async () => {
    if (reminderValue.enabled && reminderValue.custom) {
      const found = validateRules(reminderValue.custom);
      setRuleErrors(found);
      if (hasRuleErrors(found)) return;
    }
    const found = validateForm(values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setStep(PRICE);
      return;
    }

    setFormError(null);
    setSaving(true);
    try {
      // The form holds the next payment date; re-anchoring the schedule only when the user changed it.
      const { first_payment_date: _anchor, ...payload } = toPayload(values);
      const dateChanged = values.firstPaymentDate !== subscription.next_payment_date;
      await update.mutateAsync({ ...payload, ...(dateChanged ? { first_payment_date: values.firstPaymentDate } : {}), reminders_enabled: reminderValue.enabled });
      if (reminderValue.enabled) {
        // Custom rules replace the saved ones; "my default" on a subscription with its own rules clears them.
        if (reminderValue.custom) await replaceRules.mutateAsync(reminderValue.custom);
        else if (usesOwnRules) await replaceRules.mutateAsync([]);
      }
      onDone();
    } catch (error) {
      const fields = serverFieldErrors(error);
      if (fields) {
        setErrors(fields);
        setStep(PRICE);
      } else {
        setFormError(error);
      }
    } finally {
      setSaving(false);
    }
  };

  if (step === PRICE) {
    return (
      <StepFrame
        footer={
          <View className="gap-3">
            <Button label={t('form.continue')} onPress={goNext} />
            <Button label={t('common.cancel')} variant="secondary" onPress={onDone} />
          </View>
        }>
        <SubscriptionPriceStep value={values} onChange={patch} errors={errors} categories={categories.data} today={today} />
      </StepFrame>
    );
  }
  return (
    <StepFrame
      footer={
        <View className="gap-3">
          <ErrorMessage error={formError} />
          <Button label={t('common.save')} onPress={save} loading={saving} disabled={!online} />
          <Button label={t('common.back')} variant="secondary" onPress={() => setStep(PRICE)} />
        </View>
      }>
      <SubscriptionReminderStep
        value={reminderValue}
        onChange={setReminders}
        defaults={defaults.isError ? [] : defaults.data}
        errors={ruleErrors}
        email={user.email}
        paymentDate={values.firstPaymentDate}
        today={today}
      />
    </StepFrame>
  );
}
