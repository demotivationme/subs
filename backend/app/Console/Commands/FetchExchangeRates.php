<?php

namespace App\Console\Commands;

use App\Models\ExchangeRate;
use App\Services\CurrencyConverter;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use SimpleXMLElement;

class FetchExchangeRates extends Command
{
    protected $signature = 'rates:fetch';

    protected $description = 'Fetch the daily ECB euro reference rates';

    public function handle(): int
    {
        $body = Http::timeout(20)->retry(3, 1000)->get(config('subs.ecb_url'))->throw()->body();

        $day = (new SimpleXMLElement($body))->Cube->Cube;
        $date = (string) $day['time'];

        $rows = [];
        foreach ($day->Cube as $cube) {
            $rows[] = ['date' => $date, 'base' => 'EUR', 'quote' => (string) $cube['currency'], 'rate' => (string) $cube['rate']];
        }

        if ($rows === []) {
            $this->error('The ECB response contained no rates.');

            return self::FAILURE;
        }

        ExchangeRate::query()->upsert($rows, ['date', 'quote'], ['rate']);
        CurrencyConverter::forgetRates();

        $this->info(sprintf('Stored %d rates for %s.', count($rows), $date));

        return self::SUCCESS;
    }
}
