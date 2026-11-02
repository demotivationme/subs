import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useMe } from '@/api/me';
import { useReminderDefaults, useSubscriptionRules, useUpdateSubscriptionRules } from '@/api/reminders';
import { useUpdateSubscription } from '@/api/subscriptions';
import type { ReminderRuleInput, Subscription } from '@/api/types';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Loading } from '@/components/Loading';
import { ReminderEditor, RuleSummary } from '@/components/ReminderEditor';
import { Section } from '@/components/Section';
import { SwitchRow } from '@/components/SwitchRow';
import { hasRuleErrors, toRuleInputs, validateRules, type RuleErrors } from '@/features/reminders/rules';

/** Remind me on/off, then this subscription's own rules or the user's defaults; an empty list reverts to them. */
export function SubscriptionReminders({ subscription }: { subscription: Pick<Subscription, 'id' | 'reminders_enabled'> }) {
  const { t } = useTranslation();
  const id = subscription.id;
  const rules = useSubscriptionRules(id);
  const defaults = useReminderDefaults();
  const me = useMe();
  const toggle = useUpdateSubscription(id);
  const save = useUpdateSubscriptionRules(id);
  const [draft, setDraft] = useState<ReminderRuleInput[] | null>(null);
  const [errors, setErrors] = useState<RuleErrors[]>([]);

  const submit = (next: ReminderRuleInput[]) => {
    const found = validateRules(next);
    setErrors(found);
    if (hasRuleErrors(found)) return;
    save.mutate(next, { onSuccess: () => setDraft(null) });
  };

  const current = rules.data;
  return (
    <Section title={t('subscription.reminders')}>
      <SwitchRow
        label={t('form.remindMe')}
        value={subscription.reminders_enabled}
        disabled={toggle.isPending}
        onChange={(reminders_enabled) => toggle.mutate({ reminders_enabled })}
      />
      <ErrorMessage error={toggle.error} />

      {!subscription.reminders_enabled ? null : !current ? (
        rules.isError ? <ErrorMessage error={rules.error} /> : <Loading />
      ) : draft === null ? (
        <View className="gap-3">
          <View className="flex-row items-center gap-3 rounded-2xl bg-surface p-3.5 dark:bg-surface-dark">
            <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-accent-soft dark:bg-accent-soft-dark">
              <Ionicons name="alarm-outline" size={18} color="#0B7A57" />
            </View>
            <View className="flex-1">
              {current.usesDefaults ? <AppText variant="muted">{t('subscription.usingDefaults')}</AppText> : <RuleSummary rules={current.rules} />}
            </View>
          </View>
          {save.isSuccess ? <AppText variant="muted">{t('reminders.saved')}</AppText> : null}
          <View className="flex-row gap-3">
            <Button
              label={t('subscription.customize')}
              variant="secondary"
              className="flex-1"
              onPress={() => setDraft(toRuleInputs(current.usesDefaults ? (defaults.data ?? []) : current.rules))}
            />
            {current.usesDefaults ? null : (
              <Button label={t('subscription.useDefaults')} variant="secondary" className="flex-1" loading={save.isPending} onPress={() => submit([])} />
            )}
          </View>
        </View>
      ) : (
        <View className="gap-4">
          <ReminderEditor rules={draft} onChange={setDraft} errors={errors} email={me.data?.email} />
          <Button label={t('common.save')} loading={save.isPending} onPress={() => submit(draft)} />
          <Button label={t('common.cancel')} variant="secondary" onPress={() => setDraft(null)} />
        </View>
      )}
      <ErrorMessage error={save.error} />
    </Section>
  );
}
