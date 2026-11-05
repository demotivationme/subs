<?php

use App\Exceptions\BackupCheckFailed;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Exceptions;
use Illuminate\Support\Facades\Log;

beforeEach(function () {
    Carbon::setTestNow('2026-11-05 12:00:00');
    $this->file = sys_get_temp_dir().'/subs-status-'.bin2hex(random_bytes(4)).'.json';
    config(['subs.backup_status_file' => $this->file]);
    $this->status = fn (array $values) => file_put_contents($this->file, json_encode(array_merge([
        'last_run_at' => '2026-11-05T03:00:12Z', 'last_run_ok' => true, 'last_success_at' => '2026-11-05T03:00:12Z',
        'object' => 'daily/subs-20261105T030001Z.dump.age', 'size_bytes' => 4096, 'error' => null,
    ], $values)));
});

afterEach(fn () => @unlink($this->file));

it('stays quiet when the backup is fresh', function () {
    ($this->status)([]);
    Log::shouldReceive('error')->never();
    Exceptions::fake();

    $this->artisan('backups:check')->assertSuccessful();

    Exceptions::assertNothingReported();
});

it('logs an error when the last success is older than 26 hours', function () {
    ($this->status)(['last_run_at' => '2026-11-04T09:00:00Z', 'last_success_at' => '2026-11-04T09:00:00Z']);
    Log::shouldReceive('error')->once()->withArgs(fn (string $message) => $message === 'Backup is stale');
    Exceptions::fake();

    $this->artisan('backups:check')->assertSuccessful();

    Exceptions::assertReported(fn (BackupCheckFailed $e) => $e->getMessage() === 'Backup is stale');
});

it('logs an error when the last run failed', function () {
    ($this->status)(['last_run_ok' => false, 'error' => 'upload: access denied']);
    Log::shouldReceive('error')->once()
        ->withArgs(fn (string $message, array $context) => $message === 'Last backup run failed' && $context['error'] === 'upload: access denied');
    Exceptions::fake();

    $this->artisan('backups:check')->assertSuccessful();

    Exceptions::assertReported(fn (BackupCheckFailed $e) => $e->getMessage() === 'Last backup run failed');
});

it('logs an error when no backup has succeeded yet', function (?string $contents) {
    if ($contents !== null) {
        file_put_contents($this->file, $contents);
    }
    Log::shouldReceive('error')->once()->withArgs(fn (string $message) => $message === 'No database backup has succeeded yet');
    Exceptions::fake();

    $this->artisan('backups:check')->assertSuccessful();

    Exceptions::assertReported(fn (BackupCheckFailed $e) => $e->getMessage() === 'No database backup has succeeded yet');
})->with(['missing file' => null, 'broken json' => '{not json', 'empty object' => '{}']);
