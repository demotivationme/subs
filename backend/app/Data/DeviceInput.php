<?php

namespace App\Data;

use App\Enums\Platform;

final readonly class DeviceInput
{
    public function __construct(
        public string $token,
        public Platform $platform,
    ) {}
}
