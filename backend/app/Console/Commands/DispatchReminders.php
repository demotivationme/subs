<?php

namespace App\Console\Commands;

use App\Services\ReminderDispatcher;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class DispatchReminders extends Command
{
    public const HEARTBEAT_KEY = 'reminders:heartbeat';

    protected $signature = 'reminders:dispatch';

    protected $description = 'Advance payment dates and queue payment reminders that are due';

    public function handle(ReminderDispatcher $dispatcher): int
    {
        $now = CarbonImmutable::now();
        $queued = $dispatcher->dispatch($now);

        Cache::forever(self::HEARTBEAT_KEY, $now->getTimestamp());
        $this->info("Queued {$queued} reminder(s).");

        return self::SUCCESS;
    }
}
