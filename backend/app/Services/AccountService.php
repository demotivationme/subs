<?php

namespace App\Services;

use App\Data\ProfileChanges;
use App\Models\User;
use App\Repositories\ServiceRepository;
use App\Repositories\TransactionRunner;
use App\Repositories\UserRepository;

final class AccountService
{
    public function __construct(
        private readonly UserRepository $users,
        private readonly TransactionRunner $transactions,
        private readonly ServiceRepository $services,
        private readonly ServiceLogoStorage $logos,
    ) {}

    public function update(User $user, ProfileChanges $changes): User
    {
        $this->users->update($user, $changes->toArray());

        return $user;
    }

    public function delete(User $user): void
    {
        $logos = $this->services->logoPathsOwnedBy($user);

        $this->transactions->run(fn () => $this->users->delete($user));

        // Files only once the rows are really gone.
        $this->logos->delete($logos);
    }
}
