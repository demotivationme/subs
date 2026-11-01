<?php

namespace App\Data;

/** A partial profile update: null means "not sent". */
final readonly class ProfileChanges
{
    public function __construct(
        public ?string $name = null,
        public ?string $timezone = null,
        public ?string $currency = null,
        public ?string $locale = null,
    ) {}

    /** @return array<string, string> the fields that were sent */
    public function toArray(): array
    {
        return array_filter([
            'name' => $this->name,
            'timezone' => $this->timezone,
            'currency' => $this->currency,
            'locale' => $this->locale,
        ], fn (?string $value) => $value !== null);
    }
}
