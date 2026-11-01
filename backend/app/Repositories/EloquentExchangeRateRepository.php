<?php

namespace App\Repositories;

use App\Models\ExchangeRate;

final class EloquentExchangeRateRepository implements ExchangeRateRepository
{
    public function latest(): array
    {
        return ExchangeRate::query()
            ->selectRaw('DISTINCT ON (quote) quote, rate')
            ->orderBy('quote')
            ->orderByDesc('date')
            ->pluck('rate', 'quote')
            ->map(fn ($rate) => (float) $rate)
            ->all();
    }

    public function store(string $date, array $rates): void
    {
        $rows = [];
        foreach ($rates as $quote => $rate) {
            $rows[] = ['date' => $date, 'base' => 'EUR', 'quote' => $quote, 'rate' => $rate];
        }

        ExchangeRate::query()->upsert($rows, ['date', 'quote'], ['rate']);
    }
}
