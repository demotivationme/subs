<?php

namespace App\Data;

final readonly class PasswordResetInput
{
    public function __construct(
        public string $email,
        public string $password,
        public string $token,
    ) {}
}
