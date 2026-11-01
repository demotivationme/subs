<?php

namespace App\Providers;

use App\Repositories\CategoryRepository;
use App\Repositories\DatabaseTransactionRunner;
use App\Repositories\DeviceTokenRepository;
use App\Repositories\EloquentCategoryRepository;
use App\Repositories\EloquentDeviceTokenRepository;
use App\Repositories\EloquentExchangeRateRepository;
use App\Repositories\EloquentNotificationRepository;
use App\Repositories\EloquentPushSubscriptionRepository;
use App\Repositories\EloquentReminderRuleRepository;
use App\Repositories\EloquentSentReminderRepository;
use App\Repositories\EloquentServiceRepository;
use App\Repositories\EloquentSubscriptionRepository;
use App\Repositories\EloquentUserRepository;
use App\Repositories\ExchangeRateRepository;
use App\Repositories\NotificationRepository;
use App\Repositories\PushSubscriptionRepository;
use App\Repositories\ReminderRuleRepository;
use App\Repositories\SentReminderRepository;
use App\Repositories\ServiceRepository;
use App\Repositories\SubscriptionRepository;
use App\Repositories\TransactionRunner;
use App\Repositories\UserRepository;
use Illuminate\Support\ServiceProvider;

class RepositoryServiceProvider extends ServiceProvider
{
    /** @var array<class-string, class-string> */
    public array $bindings = [
        TransactionRunner::class => DatabaseTransactionRunner::class,
        UserRepository::class => EloquentUserRepository::class,
        CategoryRepository::class => EloquentCategoryRepository::class,
        ServiceRepository::class => EloquentServiceRepository::class,
        SubscriptionRepository::class => EloquentSubscriptionRepository::class,
        ReminderRuleRepository::class => EloquentReminderRuleRepository::class,
        SentReminderRepository::class => EloquentSentReminderRepository::class,
        DeviceTokenRepository::class => EloquentDeviceTokenRepository::class,
        PushSubscriptionRepository::class => EloquentPushSubscriptionRepository::class,
        NotificationRepository::class => EloquentNotificationRepository::class,
        ExchangeRateRepository::class => EloquentExchangeRateRepository::class,
    ];
}
