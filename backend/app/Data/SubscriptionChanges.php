<?php

namespace App\Data;

/**
 * A partial subscription update. $attributes holds the sent columns (notes may be null);
 * the service is sent separately as an id or a name to resolve.
 */
final readonly class SubscriptionChanges
{
    /** @param array<string, mixed> $attributes */
    public function __construct(
        public array $attributes,
        public ?int $serviceId = null,
        public ?string $serviceName = null,
    ) {}

    public function changesService(): bool
    {
        return $this->serviceId !== null || $this->serviceName !== null;
    }
}
