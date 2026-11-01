<?php

namespace App\Notifications;

use App\Enums\Channel;
use App\Enums\SubscriptionStatus;
use App\Models\ReminderRule;
use App\Models\Subscription;
use App\Models\User;
use App\Notifications\Channels\ExpoChannel;
use App\Notifications\Channels\ExpoMessage;
use App\Repositories\DeviceTokenRepository;
use App\Repositories\PushSubscriptionRepository;
use App\Repositories\SubscriptionRepository;
use App\Services\CurrencyConverter;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Number;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

class PaymentReminder extends Notification implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public bool $deleteWhenMissingModels = true;

    public function __construct(
        public Subscription $subscription,
        public ReminderRule $rule,
        public CarbonImmutable $paymentDate,
    ) {}

    public function backoff(): array
    {
        return [60, 300, 900];
    }

    /** The job may run minutes after dispatch: skip it if the subscription was deleted or paused meanwhile. */
    public function shouldSend(User $notifiable, string $channel): bool
    {
        $current = app(SubscriptionRepository::class)->findWithTrashed($this->subscription->id);

        return $current !== null && ! $current->trashed() && $current->status === SubscriptionStatus::Active;
    }

    public function via(User $notifiable): array
    {
        $channels = [];

        if ($this->rule->hasChannel(Channel::Push)) {
            if (app(DeviceTokenRepository::class)->hasAny($notifiable)) {
                $channels[] = ExpoChannel::class;
            }
            if (app(PushSubscriptionRepository::class)->hasAny($notifiable)) {
                $channels[] = WebPushChannel::class;
            }
        }
        if ($this->rule->hasChannel(Channel::InApp)) {
            $channels[] = 'database';
        }
        if ($this->rule->hasChannel(Channel::Email) && $notifiable->hasVerifiedEmail()) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    public function toArray(User $notifiable): array
    {
        return [
            'subscription_id' => $this->subscription->id,
            'payment_date' => $this->paymentDate->toDateString(),
            'days_before' => $this->rule->days_before,
            'title' => $this->title(),
            'body' => $this->body(),
        ];
    }

    public function toExpo(User $notifiable): ExpoMessage
    {
        return new ExpoMessage($this->title(), $this->body(), $this->pushData());
    }

    public function toWebPush(User $notifiable, Notification $notification): WebPushMessage
    {
        return (new WebPushMessage)->title($this->title())->body($this->body())->data($this->pushData());
    }

    public function toMail(User $notifiable): MailMessage
    {
        $replace = ['service' => $this->serviceName(), 'date' => $this->date(), 'amount' => $this->amount()];

        return (new MailMessage)
            ->subject(__('notifications.reminder.mail_subject', $replace))
            ->line(__('notifications.reminder.mail_line', $replace))
            ->action(__('notifications.reminder.mail_action'), config('subs.frontend_url').$this->pushData()['url']);
    }

    private function title(): string
    {
        return trans_choice('notifications.reminder.title', $this->rule->days_before, [
            'service' => $this->serviceName(),
            'days' => $this->rule->days_before,
        ]);
    }

    private function body(): string
    {
        return __('notifications.reminder.body', ['amount' => $this->amount(), 'date' => $this->date()]);
    }

    private function serviceName(): string
    {
        return $this->subscription->service->name;
    }

    private function amount(): string
    {
        $currency = $this->subscription->currency;

        return Number::currency(
            $this->subscription->amount / 10 ** CurrencyConverter::decimals($currency),
            in: $currency,
            locale: app()->getLocale(),
        );
    }

    private function date(): string
    {
        return $this->paymentDate->locale(app()->getLocale())->isoFormat('LL');
    }

    private function pushData(): array
    {
        return ['subscription_id' => $this->subscription->id, 'url' => '/subscriptions/'.$this->subscription->id];
    }
}
