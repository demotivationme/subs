import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useMe } from '@/api/me';
import { useReminderDefaults, useUpdateReminderDefaults } from '@/api/reminders';
import type { ReminderRule } from '@/api/types';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Loading } from '@/components/Loading';
import { ReminderEditor } from '@/components/ReminderEditor';
import { Screen } from '@/components/Screen';
import { hasRuleErrors, toRuleInputs, validateRules, type RuleErrors } from '@/features/reminders/rules';

function Editor({ initial }: { initial: ReminderRule[] }) {
  const { t } = useTranslation();
  const me = useMe();
  const save = useUpdateReminderDefaults();
  const [draft, setDraft] = useState(() => toRuleInputs(initial));
  const [errors, setErrors] = useState<RuleErrors[]>([]);

  const submit = () => {
    const found = validateRules(draft);
    setErrors(found);
    if (!hasRuleErrors(found)) save.mutate(draft, { onSuccess: () => router.back() });
  };

  return (
    <Screen>
      <AppText variant="heading">{t('settings.defaultReminders')}</AppText>
      <AppText variant="muted">{t('settings.defaultRemindersHelp')}</AppText>
      <ReminderEditor rules={draft} onChange={setDraft} errors={errors} email={me.data?.email} />
      <ErrorMessage error={save.error} />
      <Button label={t('common.save')} loading={save.isPending} onPress={submit} />
    </Screen>
  );
}

export default function DefaultRemindersScreen() {
  const defaults = useReminderDefaults();
  if (defaults.data) return <Editor initial={defaults.data} />;
  return defaults.isError ? (
    <Screen>
      <ErrorMessage error={defaults.error} />
    </Screen>
  ) : (
    <Loading />
  );
}
