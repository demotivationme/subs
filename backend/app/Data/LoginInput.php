<?php

namespace App\Data;

final readonly class LoginInput
{
    public function __construct(
        public string $email,
        public string $password,
        public string $deviceName,
    ) {}
}
