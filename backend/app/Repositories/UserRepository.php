<?php

namespace App\Repositories;

use App\Data\RegisterInput;
use App\Models\User;

/** Users, their API tokens and everything an account deletion removes. */
interface UserRepository
{
    public function create(RegisterInput $input): User;

    /** By email, case-insensitive (emails are stored lower-case). */
    public function findByEmail(string $email): ?User;

    public function findOrFail(int $id): User;

    /** @param array<string, string> $attributes */
    public function update(User $user, array $attributes): void;

    /** Serialises writes for one user until the surrounding transaction ends. */
    public function lock(User $user): void;

    public function setPassword(User $user, string $password): void;

    public function markEmailVerified(User $user): bool;

    /** @return string the plain-text token */
    public function issueToken(User $user, string $deviceName): string;

    public function revokeCurrentToken(User $user): void;

    public function revokeTokens(User $user): void;

    /** Deletes the user with their tokens, inbox and pending password resets; other rows cascade. */
    public function delete(User $user): void;
}
