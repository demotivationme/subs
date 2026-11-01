<?php

namespace App\Data;

final readonly class RegisterInput
{
    public function __construct(
        public string $name,
        public string $email,
        public string $password,
        public string $timezone,
        public string $currency,
        public string $locale,
        public string $deviceName,
    ) {}
}
