import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Category, Period } from '@/api/types';
import type { FieldErrors, SubscriptionFormValues } from '@/features/subscriptions/schema';
import { useLocale } from '@/i18n/useLocale';
import { currencyOptions } from '@/lib/currencies';
import { addDays, formatDate } from '@/lib/dates';
import { translateError } from '@/lib/errors';
import { currencySymbol, minorToInput, parseMoney } from '@/lib/money';

import { AppText } from './AppText';
import { Button } from './Button';
import { DateTimeModal } from './DateTimeModal';
import { SegmentedChoice } from './SegmentedChoice';
import { SegmentedControl } from './SegmentedControl';
import { SelectField } from './SelectField';
import { ServiceIcon } from './ServiceIcon';
import { TextField } from './TextField';

type DateChoice = 'today' | 'tomorrow' | 'date';

type Props = {
  value: SubscriptionFormValues;
  onChange: (patch: Partial<SubscriptionFormValues>) => void;
  errors: FieldErrors;
  categories: Category[];
  /** Today in the user's timezone (YYYY-MM-DD); anchors the Today / Tomorrow chips. */
  today: string;
  /** The chosen service chip; omit it to hide the chip row (e.g. when editing). */
  service?: { name: string; logo_url: string | null; color: string | null };
  onChangeService?: () => void;
};

const DATE = 'date';

/** Step 2: amount, billing cycle, next payment and category. Reused, prefilled, for editing. */
export function SubscriptionPriceStep({ value, onChange, errors, categories, today, service, onChangeService }: Props) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [showInterval, setShowInterval] = useState(value.intervalCount !== '1');
  const [showNote, setShowNote] = useState(value.notes !== '');
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  const tomorrow = addDays(today, 1);
  const dateChoice: DateChoice = value.firstPaymentDate === today ? 'today' : value.firstPaymentDate === tomorrow ? 'tomorrow' : 'date';
  const dateOptions: { value: DateChoice; label: string }[] = [
    { value: 'today', label: t('form.today') },
    { value: 'tomorrow', label: t('form.tomorrow') },
    { value: 'date', label: dateChoice === 'date' && value.firstPaymentDate !== '' ? formatDate(value.firstPaymentDate, locale) : t('form.pickDate') },
  ];
  const periodOptions: { value: Period; label: string }[] = [
    { value: 'week', label: t('form.weekly') },
    { value: 'month', label: t('form.monthly') },
    { value: 'year', label: t('form.yearly') },
  ];
  const categoryLabel = categories.find((c) => c.id === value.categoryId)?.label ?? t('form.categoryAuto');

  // Show what was understood: "12,99" becomes "12.99" once the field loses focus.
  const normalizeAmount = () => {
    const minor = parseMoney(value.amount, value.currency);
    if (minor !== null) onChange({ amount: minorToInput(minor, value.currency) });
  };

  return (
    <View className="gap-6">
      {service ? (
        <View className="flex-row items-center gap-3 rounded-2xl bg-surface p-3 dark:bg-surface-dark">
          <ServiceIcon service={service} size={32} />
          <AppText className="flex-1 font-semibold">{service.name}</AppText>
          {onChangeService ? <Button label={t('form.change')} variant="ghost" onPress={onChangeService} className="h-9" /> : null}
        </View>
      ) : null}

      <AppText variant="title">{t('form.priceTitle')}</AppText>

      <View className="gap-1.5">
        <AppText variant="muted" className="font-medium text-[13px]">{t('form.amount')}</AppText>
        <View className="flex-row items-center gap-3">
          <AppText className="font-display text-[44px] text-muted dark:text-muted-dark">{currencySymbol(value.currency, locale)}</AppText>
          <TextInput
            accessibilityLabel={t('form.amount')}
            value={value.amount}
            onChangeText={(amount) => onChange({ amount })}
            onBlur={normalizeAmount}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#9AA3AF"
            // An explicit height and no vertical padding: iOS otherwise clips Manrope's tall glyphs at 44px.
            style={{ height: 60, paddingVertical: 0 }}
            className="min-w-0 flex-1 font-display text-[44px] text-ink dark:text-ink-dark"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('form.currency')}
            accessibilityValue={{ text: value.currency }}
            onPress={() => setCurrencyOpen(true)}
            className="h-9 justify-center rounded-full border border-line bg-surface px-3.5 dark:border-line-dark dark:bg-surface-dark">
            <AppText className="font-semibold text-sm">{value.currency}</AppText>
          </Pressable>
        </View>
        {errors.amount ? <AppText variant="error">{translateError(errors.amount)}</AppText> : null}
        {errors.currency ? <AppText variant="error">{translateError(errors.currency)}</AppText> : null}
      </View>

      <View className="gap-2">
        <AppText variant="muted" className="font-medium text-[13px]">{t('form.billed')}</AppText>
        <SegmentedControl options={periodOptions} value={value.period} onChange={(period) => onChange({ period })} />
        {errors.period ? <AppText variant="error">{translateError(errors.period)}</AppText> : null}
        {showInterval ? (
          <TextField
            label={t('form.everyN')}
            keyboardType="number-pad"
            value={value.intervalCount}
            onChangeText={(intervalCount) => onChange({ intervalCount })}
            error={translateError(errors.intervalCount)}
          />
        ) : (
          <Button label={t('form.everyFew')} variant="ghost" onPress={() => setShowInterval(true)} className="self-start" />
        )}
      </View>

      <View className="gap-2">
        <SegmentedChoice
          label={t('form.nextPayment')}
          options={dateOptions}
          value={dateChoice}
          onChange={(choice) => {
            if (choice === 'today') onChange({ firstPaymentDate: today });
            else if (choice === 'tomorrow') onChange({ firstPaymentDate: tomorrow });
            else setDateOpen(true);
          }}
        />
        {errors.firstPaymentDate ? <AppText variant="error">{translateError(errors.firstPaymentDate)}</AppText> : null}
      </View>

      <View className="flex-row items-center justify-between gap-3 border-t border-line pt-4 dark:border-line-dark">
        <View className="flex-1">
          <AppText variant="muted" className="font-medium text-[13px]">{t('form.category')}</AppText>
          <AppText className="font-medium">{categoryLabel}</AppText>
        </View>
        <Button label={t('form.changeCategory')} variant="ghost" onPress={() => setCategoryOpen(true)} />
      </View>
      {errors.categoryId ? <AppText variant="error">{translateError(errors.categoryId)}</AppText> : null}

      {showNote ? (
        <TextField label={t('form.notes')} multiline value={value.notes} onChangeText={(notes) => onChange({ notes })} error={translateError(errors.notes)} />
      ) : (
        <Button label={t('form.addNote')} variant="ghost" onPress={() => setShowNote(true)} className="self-start" />
      )}

      <SelectField
        label={t('form.currency')}
        value={value.currency}
        options={currencyOptions(value.currency)}
        onChange={(currency) => onChange({ currency })}
        open={currencyOpen}
        onOpenChange={setCurrencyOpen}
        hideTrigger
      />
      <SelectField
        label={t('form.category')}
        value={value.categoryId}
        options={[{ value: null, label: t('form.categoryAuto') }, ...categories.map((c) => ({ value: c.id, label: c.label }))]}
        onChange={(categoryId) => onChange({ categoryId })}
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        hideTrigger
      />
      <DateTimeModal
        mode={DATE}
        visible={dateOpen}
        title={t('form.nextPayment')}
        value={value.firstPaymentDate}
        fallback={addDays(today, 7)}
        onClose={() => setDateOpen(false)}
        onSave={(firstPaymentDate) => {
          onChange({ firstPaymentDate });
          setDateOpen(false);
        }}
      />
    </View>
  );
}
