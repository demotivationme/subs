<?php

namespace App\Services;

use App\Models\ExchangeRate;
use Illuminate\Support\Facades\Cache;

final class CurrencyConverter
{
    public const CACHE_KEY = 'exchange_rates:latest';

    /** @var array<string, float>|null */
    private ?array $rates = null;

    public static function decimals(string $currency): int
    {
        return config('subs.currency_decimals')[$currency] ?? 2;
    }

    public static function forgetRates(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /** Converts minor units of $from into minor units of $to; null when either rate is unknown. */
    public function convert(float $minor, string $from, string $to): ?float
    {
        if ($from === $to) {
            return $minor;
        }

        $fromRate = $this->rate($from);
        $toRate = $this->rate($to);

        if ($fromRate === null || $toRate === null) {
            return null;
        }

        $major = $minor / 10 ** self::decimals($from);

        return round($major / $fromRate * $toRate * 10 ** self::decimals($to), 6);
    }

    /** Units of $currency per 1 EUR, from the most recent stored day. */
    public function rate(string $currency): ?float
    {
        if ($currency === 'EUR') {
            return 1.0;
        }

        $this->rates ??= Cache::remember(self::CACHE_KEY, now()->addDay(), fn () => ExchangeRate::query()
            ->selectRaw('DISTINCT ON (quote) quote, rate')
            ->orderBy('quote')
            ->orderByDesc('date')
            ->pluck('rate', 'quote')
            ->map(fn ($rate) => (float) $rate)
            ->all());

        return $this->rates[$currency] ?? null;
    }
}
