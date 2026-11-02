<?php

namespace App\Data;

final readonly class StatsQuery
{
    public function __construct(
        public int $year,
        public ?int $month = null,
    ) {}
}
