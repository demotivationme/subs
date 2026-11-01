<?php

namespace App\Services;

use App\Data\ProfileChanges;
use App\Models\User;
use App\Repositories\TransactionRunner;
use App\Repositories\UserRepository;

final class AccountService
{
    public function __construct(
        private readonly UserRepository $users,
        private readonly TransactionRunner $transactions,
    ) {}

    public function update(User $user, ProfileChanges $changes): User
    {
        $this->users->update($user, $changes->toArray());

        return $user;
    }

    public function delete(User $user): void
    {
        $this->transactions->run(fn () => $this->users->delete($user));
    }
}
