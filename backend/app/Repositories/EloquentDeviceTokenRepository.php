<?php

namespace App\Repositories;

use App\Data\DeviceInput;
use App\Models\DeviceToken;
use App\Models\User;

final class EloquentDeviceTokenRepository implements DeviceTokenRepository
{
    public function register(User $user, DeviceInput $input): void
    {
        DeviceToken::updateOrCreate(
            ['token' => $input->token],
            ['user_id' => $user->id, 'platform' => $input->platform, 'last_seen_at' => now()],
        );
    }

    public function deleteForUser(User $user, string $token): void
    {
        $user->deviceTokens()->where('token', $token)->delete();
    }

    public function delete(string $token): void
    {
        DeviceToken::where('token', $token)->delete();
    }

    public function tokensFor(User $user): array
    {
        return $user->deviceTokens()->pluck('token')->all();
    }

    public function hasAny(User $user): bool
    {
        return $user->deviceTokens()->exists();
    }
}
