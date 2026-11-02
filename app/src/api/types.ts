export type Channel = 'push' | 'in_app' | 'email';
export type Period = 'week' | 'month' | 'year';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';
export type DevicePlatform = 'ios' | 'android';

/** Laravel JsonResource wrapping. */
export type Data<T> = { data: T };

export type Paginated<T> = {
  data: T[];
  meta: { current_page: number; last_page: number; total: number };
};

export type User = {
  id: number;
  name: string;
  email: string;
  email_verified: boolean;
  timezone: string;
  currency: string;
  locale: string;
  is_premium: boolean;
};

export type AuthResponse = { token: string; user: User };

export type Category = {
  id: number;
  key: string | null;
  label: string;
  icon: string | null;
  color: string | null;
  is_custom: boolean;
};

export type Service = {
  id: number;
  name: string;
  logo_url: string | null;
  color: string | null;
  default_category_id: number | null;
  is_custom: boolean;
};

export type Subscription = {
  id: number;
  service: { id: number; name: string; logo_url: string | null; color: string | null };
  category: { id: number; label: string; icon: string | null; color: string | null };
  amount: number;
  currency: string;
  period: Period;
  interval_count: number;
  first_payment_date: string;
  next_payment_date: string;
  status: SubscriptionStatus;
  notes: string | null;
  reminders_enabled: boolean;
  /** In the user's main currency, minor units; null when the currency has no rate. */
  monthly_equivalent: number | null;
};

export type ReminderRule = {
  id: number;
  days_before: number;
  time_of_day: string;
  channels: Channel[];
};

export type ReminderRuleInput = Omit<ReminderRule, 'id'>;

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  subscription_id: number | null;
  payment_date: string | null;
  read_at: string | null;
  created_at: string;
};

export type Dashboard = {
  currency: string;
  monthly_total: number;
  yearly_total: number;
  count: number;
  by_category: { category_id: number; label: string; monthly: number; percent: number }[];
  upcoming: { subscription_id: number; name: string; date: string; amount: number; currency: string }[];
  most_expensive: { subscription_id: number; name: string; monthly: number }[];
  unconverted: { subscription_id: number; currency: string }[];
};

export type StatsPayment = {
  subscription_id: number;
  name: string;
  date: string;
  amount: number;
  currency: string;
  converted: number;
  state: 'paid' | 'expected';
};

export type StatsSavingsItem = {
  subscription_id: number;
  name: string;
  service: { id: number; name: string; logo_url: string | null; color: string | null } | null;
  status: 'cancelled' | 'paused';
  since: string;
  until: string | null;
  monthly: number;
  saved: number;
};

export type Stats = {
  currency: string;
  year: number;
  today: string;
  months: { month: number; paid: number; expected: number }[];
  spent_so_far: number;
  projected_year: number;
  savings: { total: number; monthly: number; yearly: number; items: StatsSavingsItem[] };
  by_category: { category_id: number; label: string; monthly: number; change: number }[];
  biggest: { subscription_id: number; name: string; monthly: number } | null;
  next_12_months: number;
  unconverted: { subscription_id: number; currency: string }[];
  payments?: StatsPayment[];
};
