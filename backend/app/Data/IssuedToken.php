<?php

namespace App\Data;

use App\Models\User;

/** A freshly issued API token and the user it belongs to. */
final readonly class IssuedToken
{
    public function __construct(
        public User $user,
        public string $token,
    ) {}
}
