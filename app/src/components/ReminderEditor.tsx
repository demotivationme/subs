import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ReminderRuleInput } from '@/api/types';
import { CHANNELS, MAX_RULES, defaultRule, type RuleErrors } from '@/features/reminders/rules';
import { translateError } from '@/lib/errors';

import { AppText } from './AppText';
import { Button } from './Button';
import { SegmentedChoice } from './SegmentedChoice';
import { SwitchRow } from './SwitchRow';
import { TextEntryModal } from './TextEntryModal';
import { TextField } from './TextField';

const PRESETS = [0, 1, 3, 7] as const;
const OTHER = 'other';
const ROW_LABEL: Record<(typeof CHANNELS)[number], string> = { push: 'reminders.pushRow', in_app: 'reminders.inAppRow', email: 'reminders.emailRow' };

type Props = {
  rules: ReminderRuleInput[];
  onChange: (rules: ReminderRuleInput[]) => void;
  errors?: RuleErrors[];
  /** Shown under the Email switch. */
  email?: string;
};

export function ReminderEditor({ rules, onChange, errors = [], email }: Props) {
  const { t } = useTranslation();
  const [otherOpen, setOtherOpen] = useState<number[]>([]);
  const [timeIndex, setTimeIndex] = useState<number | null>(null);

  const update = (index: number, patch: Partial<ReminderRuleInput>) =>
    onChange(rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));

  const whenOptions = [
    ...PRESETS.map((d) => ({ value: String(d), label: d === 0 ? t('reminders.onTheDay') : t('reminders.chipDays', { count: d }) })),
    { value: OTHER, label: t('reminders.other') },
  ];

  return (
    <View className="gap-5">
      {rules.map((rule, index) => {
        const isOther = otherOpen.includes(index) || !(PRESETS as readonly number[]).includes(rule.days_before);
        const error = errors[index];
        return (
          <View key={index} className="gap-4 rounded-2xl border border-line p-3.5 dark:border-line-dark">
            <View className="gap-1.5">
              <AppText variant="muted" className="font-medium text-[13px]">{t('reminders.when')}</AppText>
              <SegmentedChoice
                options={whenOptions}
                value={isOther ? OTHER : String(rule.days_before)}
                onChange={(next) => {
                  if (next === OTHER) {
                    setOtherOpen((open) => [...open, index]);
                  } else {
                    setOtherOpen((open) => open.filter((i) => i !== index));
                    update(index, { days_before: Number(next) });
                  }
                }}
              />
              {isOther ? (
                <TextField
                  label={t('reminders.daysField')}
                  keyboardType="number-pad"
                  value={Number.isNaN(rule.days_before) ? '' : String(rule.days_before)}
                  onChangeText={(text) => update(index, { days_before: text === '' ? Number.NaN : Number.parseInt(text, 10) })}
                />
              ) : null}
              <AppText variant="muted">{t('reminders.beforePayment')}</AppText>
              {error?.daysBefore ? <AppText variant="error">{translateError(error.daysBefore)}</AppText> : null}
            </View>

            <View className="gap-1.5">
              <AppText variant="muted" className="font-medium text-[13px]">{t('reminders.at')}</AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('reminders.at')}
                accessibilityValue={{ text: rule.time_of_day }}
                onPress={() => setTimeIndex(index)}
                className="h-12 justify-center rounded-xl border border-line bg-surface px-3.5 dark:border-line-dark dark:bg-surface-dark">
                <AppText numeric>{rule.time_of_day}</AppText>
              </Pressable>
              {error?.timeOfDay ? <AppText variant="error">{translateError(error.timeOfDay)}</AppText> : null}
            </View>

            <View>
              <AppText variant="muted" className="font-medium text-[13px]">{t('reminders.how')}</AppText>
              {CHANNELS.map((channel) => (
                <SwitchRow
                  key={channel}
                  label={t(ROW_LABEL[channel])}
                  description={channel === 'email' ? email : undefined}
                  value={rule.channels.includes(channel)}
                  onChange={(on) => update(index, { channels: CHANNELS.filter((c) => (c === channel ? on : rule.channels.includes(c))) })}
                />
              ))}
              {error?.channels ? <AppText variant="error">{translateError(error.channels)}</AppText> : null}
            </View>

            {index > 0 ? (
              <Button
                label={t('reminders.remove')}
                variant="secondary"
                onPress={() => {
                  setOtherOpen([]);
                  onChange(rules.filter((_, i) => i !== index));
                }}
              />
            ) : null}
          </View>
        );
      })}

      {rules.length < MAX_RULES ? (
        <Button label={t('reminders.addAnother')} variant="ghost" onPress={() => onChange([...rules, defaultRule(rules)])} />
      ) : null}

      <TextEntryModal
        visible={timeIndex !== null}
        title={t('reminders.timeTitle')}
        label={t('reminders.time')}
        value={timeIndex !== null ? (rules[timeIndex]?.time_of_day ?? '') : ''}
        onClose={() => setTimeIndex(null)}
        onSave={(time) => {
          if (timeIndex !== null) update(timeIndex, { time_of_day: time });
          setTimeIndex(null);
        }}
      />
    </View>
  );
}

/** Read-only list, e.g. "1 day before at 09:00 · Push, In-app". */
export function RuleSummary({ rules }: { rules: ReminderRuleInput[] }) {
  const { t } = useTranslation();
  if (rules.length === 0) return <AppText variant="muted">{t('reminders.none')}</AppText>;
  return (
    <View className="gap-1">
      {rules.map((rule, index) => (
        <AppText key={index}>
          {t('reminders.summary', {
            count: rule.days_before,
            time: rule.time_of_day,
            channels: rule.channels.map((c) => t(`reminders.channel.${c}`)).join(', '),
          })}
        </AppText>
      ))}
    </View>
  );
}
