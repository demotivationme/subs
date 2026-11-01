<?php

namespace App\Data;

use App\Enums\SubscriptionStatus;

final readonly class SubscriptionFilter
{
    /** @param 'price'|'next_payment'|'name' $sort */
    public function __construct(
        public ?SubscriptionStatus $status = null,
        public ?int $categoryId = null,
        public string $sort = 'next_payment',
    ) {}
}
