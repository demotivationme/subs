<?php

namespace App\Data;

/** Category fields to create or change: null means "not sent" (name is always sent on create). */
final readonly class CategoryInput
{
    public function __construct(
        public ?string $name = null,
        public ?string $icon = null,
        public ?string $color = null,
    ) {}

    /** @return array<string, string> the fields that were sent */
    public function toArray(): array
    {
        return array_filter([
            'name' => $this->name,
            'icon' => $this->icon,
            'color' => $this->color,
        ], fn (?string $value) => $value !== null);
    }
}
