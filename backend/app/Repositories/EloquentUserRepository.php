<?php

namespace App\Repositories;

use App\Data\RegisterInput;
use App\Models\User;
use Illuminate\Support\Facades\DB;

final class EloquentUserRepository implements UserRepository
{
    public function create(RegisterInput $input): User
    {
        return User::create([
            'name' => $input->name,
            'email' => $input->email,
            'password' => $input->password,
            'timezone' => $input->timezone,
            'currency' => $input->currency,
            'locale' => $input->locale,
        ]);
    }

    public function findByEmail(string $email): ?User
    {
        return User::firstWhere('email', mb_strtolower($email));
    }

    public function findOrFail(int $id): User
    {
        return User::findOrFail($id);
    }

    public function update(User $user, array $attributes): void
    {
        $user->update($attributes);
    }

    public function lock(User $user): void
    {
        User::query()->whereKey($user->id)->lockForUpdate()->first();
    }

    public function setPassword(User $user, string $password): void
    {
        $user->forceFill(['password' => $password])->save();
    }

    public function markEmailVerified(User $user): bool
    {
        return $user->markEmailAsVerified();
    }

    public function issueToken(User $user, string $deviceName): string
    {
        return $user->createToken($deviceName)->plainTextToken;
    }

    public function revokeCurrentToken(User $user): void
    {
        $user->currentAccessToken()->delete();
    }

    public function revokeTokens(User $user): void
    {
        $user->tokens()->delete();
    }

    public function delete(User $user): void
    {
        $user->tokens()->delete();
        $user->notifications()->delete();
        DB::table('password_reset_tokens')->where('email', $user->email)->delete();
        $user->pushSubscriptions()->delete();
        $user->delete();
    }
}
