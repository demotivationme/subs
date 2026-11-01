<?php

namespace App\Repositories;

/** ECB euro reference rates by day. */
interface ExchangeRateRepository
{
    /** @return array<string, float> units of each currency per 1 EUR, from its most recent stored day */
    public function latest(): array;

    /**
     * Inserts the day's rates, overwriting rates already stored for that day.
     *
     * @param  array<string, string>  $rates  currency => rate
     */
    public function store(string $date, array $rates): void;
}
