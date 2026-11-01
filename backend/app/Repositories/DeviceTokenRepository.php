<?php

namespace App\Repositories;

use App\Data\DeviceInput;
use App\Models\User;

/** Expo push tokens of users' mobile devices. */
interface DeviceTokenRepository
{
    /** Claims $input->token for $user (a token moves with the device to whoever signs in). */
    public function register(User $user, DeviceInput $input): void;

    public function deleteForUser(User $user, string $token): void;

    /** Removes a token wherever it is registered (e.g. Expo reports it unregistered). */
    public function delete(string $token): void;

    /** @return list<string> */
    public function tokensFor(User $user): array;

    public function hasAny(User $user): bool;
}
