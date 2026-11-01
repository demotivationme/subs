<?php

namespace App\Data;

use App\Enums\Period;

/** A new subscription: either $serviceId or $serviceName is set. */
final readonly class SubscriptionInput
{
    public function __construct(
        public ?int $serviceId,
        public ?string $serviceName,
        public ?int $categoryId,
        public int $amount,
        public string $currency,
        public Period $period,
        public int $intervalCount,
        public string $firstPaymentDate,
        public ?string $notes,
    ) {}
}
