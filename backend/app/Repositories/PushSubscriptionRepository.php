<?php

namespace App\Repositories;

use App\Data\WebPushInput;
use App\Models\User;

/** Browsers' Web Push subscriptions. */
interface PushSubscriptionRepository
{
    /** Creates the subscription or refreshes its keys when the user already owns the endpoint. */
    public function save(User $user, WebPushInput $input): void;

    public function delete(User $user, string $endpoint): void;

    public function hasAny(User $user): bool;
}
