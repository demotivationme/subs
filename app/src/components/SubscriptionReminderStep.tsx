import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ReminderRule, ReminderRuleInput } from '@/api/types';
import { defaultRule, firstReminder, toRuleInputs, type RuleErrors } from '@/features/reminders/rules';
import { useLocale } from '@/i18n/useLocale';
import { formatDate } from '@/lib/dates';

import { AppText } from './AppText';
import { ReminderEditor } from './ReminderEditor';
import { SegmentedControl } from './SegmentedControl';
import { SwitchRow } from './SwitchRow';

export type ReminderValue = {
  enabled: boolean;
  /** null means "use my default"; a list is the subscription's own rules. */
  custom: ReminderRuleInput[] | null;
};

type Mode = 'default' | 'custom';

type Props = {
  value: ReminderValue;
  onChange: (value: ReminderValue) => void;
  /** The account's default rules (read-only here); undefined while they load. */
  defaults: ReminderRule[] | undefined;
  errors?: RuleErrors[];
  email?: string;
  paymentDate: string;
  today: string;
  /** "Spotify · €10.99 monthly · next on Nov 11". */
  summary?: string;
};

function DefaultSummary({ rules }: { rules: ReminderRuleInput[] }) {
  const { t } = useTranslation();
  if (rules.length === 0) return <AppText variant="muted">{t('reminders.noneSet')}</AppText>;
  return (
    <View className="gap-3">
      {rules.map((rule, i) => (
        <View key={i} className="gap-2 rounded-2xl bg-surface p-3.5 dark:bg-surface-dark">
          <Line label={t('reminders.when')} text={rule.days_before === 0 ? t('reminders.onTheDay') : t('reminders.chipDays', { count: rule.days_before })} />
          <Line label={t('reminders.at')} text={rule.time_of_day} />
          <Line label={t('reminders.how')} text={rule.channels.map((c) => t(`reminders.channel.${c}`)).join(', ')} />
        </View>
      ))}
    </View>
  );
}

function Line({ label, text }: { label: string; text: string }) {
  return (
    <View className="flex-row justify-between gap-3">
      <AppText variant="muted">{label}</AppText>
      <AppText numeric className="font-medium">{text}</AppText>
    </View>
  );
}

/** Step 3: reminders on/off, my default or custom rules. Reused, prefilled, for editing. */
export function SubscriptionReminderStep({ value, onChange, defaults, errors, email, paymentDate, today, summary }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const mode: Mode = value.custom ? 'custom' : 'default';
  const loading = defaults === undefined;
  const defaultRules = toRuleInputs(defaults ?? []);
  const effective = value.custom ?? defaultRules;
  const first = value.enabled ? firstReminder(paymentDate, effective, today) : null;

  const modeOptions: { value: Mode; label: string }[] = [
    { value: 'default', label: t('form.modeDefault') },
    { value: 'custom', label: t('form.modeCustom') },
  ];
  const selectMode = (next: Mode) => {
    if (loading) return;
    if (next === 'default') onChange({ ...value, custom: null });
    else if (!value.custom) onChange({ ...value, custom: defaultRules.length > 0 ? defaultRules : [defaultRule([])] });
  };

  return (
    <View className="gap-5">
      <AppText variant="title">{t('form.remindTitle')}</AppText>
      {summary ? <AppText variant="muted">{summary}</AppText> : null}

      <SwitchRow label={t('form.remindMe')} value={value.enabled} onChange={(enabled) => onChange({ ...value, enabled })} />

      {value.enabled ? (
        <View className="gap-5">
          <SegmentedControl options={modeOptions} value={mode} onChange={selectMode} />
          {value.custom ? (
            <ReminderEditor rules={value.custom} onChange={(custom) => onChange({ ...value, custom })} errors={errors} email={email} />
          ) : (
            <View className="gap-3">
              {loading ? <ActivityIndicator accessibilityLabel={t('common.loading')} /> : <DefaultSummary rules={defaultRules} />}
              <AppText variant="muted" className="text-[13px]">{t('form.defaultHint')}</AppText>
            </View>
          )}
          {first ? (
            <AppText className="rounded-2xl bg-accent-soft p-3.5 dark:bg-accent-soft-dark">
              {t('form.firstReminder', { date: formatDate(first.date, locale), time: first.time })}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
