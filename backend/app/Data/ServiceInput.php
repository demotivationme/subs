<?php

namespace App\Data;

final readonly class ServiceInput
{
    public function __construct(
        public string $name,
        public ?int $defaultCategoryId = null,
        public ?string $color = null,
    ) {}
}
