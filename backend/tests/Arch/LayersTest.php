<?php

/*
 * Request → DTO → service → repository. Only repositories touch the database;
 * controllers stay thin and never see models' query builders or repositories.
 */

arch('only repositories use the DB facade')
    ->expect('Illuminate\Support\Facades\DB')
    ->toOnlyBeUsedIn('App\Repositories');

arch('controllers do not reach past services')
    ->expect('App\Http\Controllers')
    ->not->toUse(['App\Models', 'App\Repositories', 'Illuminate\Database']);

arch('repositories are interfaces bound to Eloquent implementations')
    ->expect('App\Repositories')
    ->classes()
    ->toHaveSuffix('Repository')
    ->ignoring(['App\Repositories\TransactionRunner', 'App\Repositories\DatabaseTransactionRunner']);

arch('DTOs are read-only')
    ->expect('App\Data')
    ->toBeReadonly()
    ->toBeFinal();
