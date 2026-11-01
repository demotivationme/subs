<?php

namespace App\Services;

use App\Repositories\ExchangeRateRepository;
use Illuminate\Support\Facades\Http;
use SimpleXMLElement;

/** Imports the ECB daily euro reference rates. */
final class ExchangeRateImporter
{
    public function __construct(private readonly ExchangeRateRepository $rates) {}

    /**
     * Fetches, stores and invalidates cached rates and dashboards.
     *
     * @return array{date: string, count: int} count is 0 when the response had no rates (nothing is stored)
     */
    public function import(): array
    {
        $body = Http::timeout(20)->retry(3, 1000)->get(config('subs.ecb_url'))->throw()->body();

        $day = (new SimpleXMLElement($body))->Cube->Cube;
        $date = (string) $day['time'];

        $rates = [];
        foreach ($day->Cube as $cube) {
            $rates[(string) $cube['currency']] = (string) $cube['rate'];
        }

        if ($rates !== []) {
            $this->rates->store($date, $rates);
            CurrencyConverter::forgetRates();
            DashboardCache::flushAll();
        }

        return ['date' => $date, 'count' => count($rates)];
    }
}
