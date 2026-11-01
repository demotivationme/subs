<?php

namespace App\Repositories;

use App\Data\WebPushInput;
use App\Models\User;

final class EloquentPushSubscriptionRepository implements PushSubscriptionRepository
{
    public function save(User $user, WebPushInput $input): void
    {
        $user->updatePushSubscription($input->endpoint, $input->publicKey, $input->authToken, $input->contentEncoding);
    }

    public function delete(User $user, string $endpoint): void
    {
        $user->deletePushSubscription($endpoint);
    }

    public function hasAny(User $user): bool
    {
        return $user->pushSubscriptions()->exists();
    }
}
