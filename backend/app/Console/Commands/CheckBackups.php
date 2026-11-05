<?php

namespace App\Console\Commands;

use App\Exceptions\BackupCheckFailed;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

final class CheckBackups extends Command
{
    protected $signature = 'backups:check';

    protected $description = 'Log an error when the last database backup is missing, failed or older than 26 hours';

    public function handle(): int
    {
        $file = config('subs.backup_status_file');
        $status = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;

        if (! is_array($status) || empty($status['last_success_at'])) {
            $this->problem('No database backup has succeeded yet');

            return self::SUCCESS;
        }

        if (($status['last_run_ok'] ?? false) !== true) {
            $this->problem('Last backup run failed', ['error' => $status['error'] ?? null]);
        }

        if (Carbon::parse($status['last_success_at'])->lt(now()->subHours(26))) {
            $this->problem('Backup is stale', ['last_success_at' => $status['last_success_at']]);
        }

        return self::SUCCESS;
    }

    /** @param array<string, mixed> $context */
    private function problem(string $message, array $context = []): void
    {
        Log::error($message, $context);
        // Log::error goes to stderr and reaches nobody; reporting lets Sentry alert.
        report(new BackupCheckFailed($message));
    }
}
