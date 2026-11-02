<?php

namespace App\Data;

/** A partial update of a user's own service: only the fields that were sent. */
final readonly class ServiceChanges
{
    /** @param array{name?: string, color?: ?string} $attributes */
    public function __construct(private array $attributes = []) {}

    /** @return array{name?: string, color?: ?string} */
    public function toArray(): array
    {
        return $this->attributes;
    }
}
