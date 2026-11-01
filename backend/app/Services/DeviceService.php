<?php

namespace App\Services;

use App\Data\DeviceInput;
use App\Data\WebPushInput;
use App\Models\User;
use App\Repositories\DeviceTokenRepository;
use App\Repositories\PushSubscriptionRepository;

/** Where push notifications go: Expo tokens of mobile apps and browsers' Web Push subscriptions. */
final class DeviceService
{
    public function __construct(
        private readonly DeviceTokenRepository $tokens,
        private readonly PushSubscriptionRepository $pushSubscriptions,
    ) {}

    public function register(User $user, DeviceInput $input): void
    {
        $this->tokens->register($user, $input);
    }

    public function forget(User $user, string $token): void
    {
        $this->tokens->deleteForUser($user, $token);
    }

    public function subscribeWebPush(User $user, WebPushInput $input): void
    {
        $this->pushSubscriptions->save($user, $input);
    }

    public function unsubscribeWebPush(User $user, string $endpoint): void
    {
        $this->pushSubscriptions->delete($user, $endpoint);
    }
}
