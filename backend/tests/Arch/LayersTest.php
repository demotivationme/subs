<?php

use App\Providers\RepositoryServiceProvider;
use App\Repositories\DatabaseTransactionRunner;
use App\Repositories\TransactionRunner;
use Symfony\Component\Finder\Finder;

/*
 * Request → DTO → service → repository. Only repositories touch the database;
 * controllers stay thin and never see models or repositories.
 */

arch('only repositories use the DB facade')
    ->expect('Illuminate\Support\Facades\DB')
    ->toOnlyBeUsedIn('App\Repositories');

arch('controllers do not reach past services')
    ->expect('App\Http\Controllers')
    ->not->toUse(['App\Models', 'App\Repositories', 'Illuminate\Database']);

arch('repository contracts are interfaces')
    ->expect('App\Repositories')
    ->interfaces()
    ->toHaveSuffix('Repository')
    ->ignoring(TransactionRunner::class);

arch('repository implementations are final')
    ->expect('App\Repositories')
    ->classes()
    ->toBeFinal();

arch('repository implementations are named Eloquent…Repository')
    ->expect('App\Repositories')
    ->classes()
    ->toHavePrefix('Eloquent')
    ->ignoring(DatabaseTransactionRunner::class);

arch('DTOs are read-only')
    ->expect('App\Data')
    ->toBeReadonly()
    ->toBeFinal();

it('binds every repository interface to an implementation of it', function () {
    $bound = array_keys((new RepositoryServiceProvider(app()))->bindings);
    $interfaces = collect(glob(app_path('Repositories/*.php')))
        ->map(fn (string $path) => 'App\\Repositories\\'.basename($path, '.php'))
        ->filter(fn (string $class) => interface_exists($class))
        ->values();

    expect($interfaces)->not->toBeEmpty();

    foreach ($interfaces as $interface) {
        expect($bound)->toContain($interface)
            ->and(app($interface))->toBeInstanceOf($interface);
    }
});

it('runs Eloquent queries only in repositories', function () {
    // Static model queries and query-builder terminals; relations and scopes may be declared in models.
    $pattern = '/[A-Z]\w*::(query|where\w*|find\w*|first\w*|create|updateOrCreate|firstOrCreate|withTrashed|onlyTrashed|upsert|insert\w*|destroy)\(|->(lockForUpdate|insertOrIgnore|upsert|chunkById|pluck|forceDelete)\(/';

    $offenders = [];
    foreach (Finder::create()->files()->name('*.php')->in(app_path())->exclude(['Repositories', 'Models']) as $file) {
        foreach (file($file->getRealPath()) as $number => $line) {
            if (preg_match($pattern, $line)) {
                $offenders[] = $file->getRelativePathname().':'.($number + 1).'  '.trim($line);
            }
        }
    }

    expect($offenders)->toBe([]);
});
