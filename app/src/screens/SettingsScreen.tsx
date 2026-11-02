import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { authApi } from '@/api/auth';
import { useDeleteAccount, useMe, useUpdateMe } from '@/api/me';
import { useReminderDefaults } from '@/api/reminders';
import type { ReminderRule, User } from '@/api/types';
import { useSession } from '@/auth/session';
import { AppText } from '@/components/AppText';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Group } from '@/components/Group';
import { Loading } from '@/components/Loading';
import { Screen } from '@/components/Screen';
import { SelectField } from '@/components/SelectField';
import { SwitchRow } from '@/components/SwitchRow';
import { TextEntryModal } from '@/components/TextEntryModal';
import { TextField } from '@/components/TextField';
import { TextLink } from '@/components/TextLink';
import { VerifyEmailBanner } from '@/components/VerifyEmailBanner';
import { SUPPORTED_LOCALES } from '@/i18n';
import { currencyOptions } from '@/lib/currencies';
import { deviceTimeZone } from '@/lib/dates';
import { isValidTimeZone, knownTimeZones } from '@/lib/timezones';
import { disablePush, enablePush, isPushEnabled, isPushSupported, type PushResult } from '@/push';

const REMINDERS_ROUTE = '/settings/reminders';
const CATEGORIES_ROUTE = '/categories';
const CHEVRON = 'chevron-forward';

const PUSH_MESSAGES: Record<Exclude<PushResult, 'enabled'>, string> = {
  denied: 'settings.pushDenied',
  unsupported: 'settings.pushUnsupported',
  failed: 'settings.pushFailed',
};

function Chevron() {
  return <Ionicons name={CHEVRON} size={16} color="#9AA3AF" />;
}

/** A tappable settings row: title on the left, current value and chevron on the right. */
function Row({ title, subtitle, value, leading, onPress }: { title: string; subtitle?: string; value?: string; leading?: ReactNode; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      className="min-h-12 flex-row items-center gap-3 border-b border-line py-3 dark:border-line-dark">
      {leading}
      <View className="flex-1 gap-0.5">
        <AppText className="font-medium">{title}</AppText>
        {subtitle ? <AppText variant="muted">{subtitle}</AppText> : null}
      </View>
      {value ? <AppText variant="muted" className="shrink">{value}</AppText> : null}
      <Chevron />
    </Pressable>
  );
}

function summarize(t: ReturnType<typeof useTranslation>['t'], rules: ReminderRule[]): string {
  if (rules.length === 0) return t('reminders.none');
  const first = rules[0];
  const line = t('reminders.summary', {
    count: first.days_before,
    time: first.time_of_day,
    channels: first.channels.map((c) => t(`reminders.channel.${c}`)).join(', '),
  });
  return rules.length > 1 ? `${line} (+${rules.length - 1})` : line;
}

function TimezoneEditor({ visible, current, onClose, onPick }: { visible: boolean; current: string; onClose: () => void; onPick: (zone: string) => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const device = deviceTimeZone();
  const zones = [...new Set([current, device, ...knownTimeZones()])].filter((z) => z.toLowerCase().includes(query.toLowerCase()));
  const typed = query.trim();
  const offerTyped = typed !== '' && isValidTimeZone(typed) && !zones.includes(typed);
  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View className="flex-1 gap-3 bg-ground p-4 pt-12 dark:bg-ground-dark">
        <AppText variant="heading">{t('settings.timezoneLabel')}</AppText>
        {device !== current ? (
          <Button
            label={t('settings.useDeviceTimezone', { timezone: device })}
            variant="secondary"
            onPress={() => {
              onPick(device);
              close();
            }}
          />
        ) : null}
        <TextField label={t('common.search')} value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} />
        {offerTyped ? (
          <Button
            label={t('settings.useZone', { zone: typed })}
            variant="secondary"
            onPress={() => {
              onPick(typed);
              close();
            }}
          />
        ) : null}
        <FlatList
          data={zones}
          keyExtractor={(z) => z}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item}
              onPress={() => {
                onPick(item);
                close();
              }}
              className="border-b border-line py-3 dark:border-line-dark">
              <AppText className={item === current ? 'font-semibold' : undefined}>{item}</AppText>
            </Pressable>
          )}
        />
        <Button label={t('common.cancel')} variant="secondary" onPress={close} />
      </View>
    </Modal>
  );
}

const EDIT = { name: 'name', currency: 'currency', language: 'language', timezone: 'timezone' } as const;
type Editing = (typeof EDIT)[keyof typeof EDIT] | null;

function ProfileGroup({ user }: { user: User }) {
  const { t } = useTranslation();
  const update = useUpdateMe();
  const [editing, setEditing] = useState<Editing>(null);
  const close = () => setEditing(null);
  const closeIf = (kind: Exclude<Editing, null>) => (open: boolean) => setEditing(open ? kind : null);

  return (
    <Group title={t('settings.profile')}>
      <Row title={t('settings.name')} value={user.name} onPress={() => setEditing(EDIT.name)} />
      <Row title={t('settings.currency')} value={user.currency} onPress={() => setEditing(EDIT.currency)} />
      <Row title={t('settings.language')} value={t(`languages.${user.locale}`, { defaultValue: user.locale })} onPress={() => setEditing(EDIT.language)} />
      <Row title={t('settings.timezoneLabel')} value={user.timezone} onPress={() => setEditing(EDIT.timezone)} />
      <ErrorMessage error={update.error} />

      <TextEntryModal
        visible={editing === EDIT.name}
        title={t('settings.nameTitle')}
        label={t('settings.name')}
        value={user.name}
        onClose={close}
        onSave={(name) => {
          close();
          if (name !== '' && name !== user.name) update.mutate({ name });
        }}
      />
      <SelectField
        hideTrigger
        label={t('settings.currency')}
        value={user.currency}
        options={currencyOptions(user.currency)}
        open={editing === EDIT.currency}
        onOpenChange={closeIf(EDIT.currency)}
        onChange={(currency) => update.mutate({ currency })}
      />
      <SelectField
        hideTrigger
        label={t('settings.language')}
        value={user.locale}
        options={SUPPORTED_LOCALES.map((locale) => ({ value: locale, label: t(`languages.${locale}`) }))}
        open={editing === EDIT.language}
        onOpenChange={closeIf(EDIT.language)}
        onChange={(locale) => update.mutate({ locale })}
      />
      <TimezoneEditor visible={editing === EDIT.timezone} current={user.timezone} onClose={close} onPick={(timezone) => update.mutate({ timezone })} />
    </Group>
  );
}

function RemindersGroup() {
  const { t } = useTranslation();
  const defaults = useReminderDefaults();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Exclude<PushResult, 'enabled'> | null>(null);
  const supported = isPushSupported();

  useEffect(() => {
    void isPushEnabled().then(setEnabled);
  }, []);

  const toggle = async (on: boolean) => {
    setBusy(true);
    setProblem(null);
    try {
      if (on) {
        const result = await enablePush();
        setEnabled(result === 'enabled');
        if (result !== 'enabled') setProblem(result);
      } else {
        await disablePush();
        setEnabled(false);
      }
    } catch {
      setProblem('failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Group title={t('settings.reminders')}>
      <Row
        title={t('settings.defaultReminders')}
        subtitle={defaults.data ? summarize(t, defaults.data) : undefined}
        leading={
          <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-accent-soft dark:bg-accent-soft-dark">
            <Ionicons name="notifications-outline" size={18} color="#0B7A57" />
          </View>
        }
        onPress={() => router.push(REMINDERS_ROUTE)}
      />
      {supported ? (
        <SwitchRow label={t('settings.pushDevice')} value={enabled} disabled={busy} onChange={(on) => void toggle(on)} />
      ) : (
        <AppText variant="muted" className="py-3">{t('settings.pushUnsupported')}</AppText>
      )}
      {problem ? <Banner tone="warning" message={t(PUSH_MESSAGES[problem])} /> : null}
    </Group>
  );
}

function AccountGroup({ user }: { user: User }) {
  const { t } = useTranslation();
  const [leaving, setLeaving] = useState(false);

  const logout = async () => {
    setLeaving(true);
    // Stop pushes to this device for this account, then revoke the token.
    await disablePush().catch(() => undefined);
    await authApi.logout().catch(() => undefined);
    await useSession.getState().signOut();
  };

  return (
    <Group title={t('settings.account')}>
      <View className="min-h-12 flex-row items-center gap-3 border-b border-line py-3 dark:border-line-dark">
        <AppText className="flex-1 font-medium">{user.email}</AppText>
        {user.email_verified ? (
          <View className="rounded-full bg-accent-soft px-2.5 py-1 dark:bg-accent-soft-dark">
            <AppText className="font-semibold text-xs text-accent dark:text-accent-dark">{t('settings.verified')}</AppText>
          </View>
        ) : null}
      </View>
      {user.email_verified ? null : (
        <View className="py-2">
          <VerifyEmailBanner />
        </View>
      )}
      <TextLink label={t('settings.categories')} onPress={() => router.push(CATEGORIES_ROUTE)} />
      <View className="py-2">
        <Button label={t('settings.logout')} variant="secondary" loading={leaving} onPress={() => void logout()} />
      </View>
    </Group>
  );
}

function DangerGroup() {
  const { t } = useTranslation();
  const remove = useDeleteAccount();
  const [password, setPassword] = useState('');

  return (
    <Group title={t('settings.dangerZone')}>
      <View className="gap-3 py-3">
        <AppText variant="muted">{t('settings.deleteWarning')}</AppText>
        <TextField label={t('settings.deletePassword')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
        <Button label={t('settings.deleteConfirm')} variant="danger" loading={remove.isPending} disabled={password === ''} onPress={() => remove.mutate(password)} />
        <ErrorMessage error={remove.error} />
      </View>
    </Group>
  );
}

export default function SettingsScreen() {
  const me = useMe();

  if (!me.data) {
    return me.isError ? (
      <Screen>
        <ErrorMessage error={me.error} />
      </Screen>
    ) : (
      <Loading />
    );
  }

  return (
    <Screen>
      <RemindersGroup />
      <ProfileGroup user={me.data} />
      <AccountGroup user={me.data} />
      <DangerGroup />
    </Screen>
  );
}
