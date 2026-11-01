<?php

namespace App\Console\Commands;

use App\Services\ExchangeRateImporter;
use Illuminate\Console\Command;

class FetchExchangeRates extends Command
{
    protected $signature = 'rates:fetch';

    protected $description = 'Fetch the daily ECB euro reference rates';

    public function handle(ExchangeRateImporter $importer): int
    {
        ['date' => $date, 'count' => $count] = $importer->import();

        if ($count === 0) {
            $this->error('The ECB response contained no rates.');

            return self::FAILURE;
        }

        $this->info(sprintf('Stored %d rates for %s.', $count, $date));

        return self::SUCCESS;
    }
}
