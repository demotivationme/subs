<?php

use App\Providers\AppServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

beforeEach(fn () => Route::get('/_client-ip', fn (Request $request) => $request->ip()));

it('trusts the private Docker ranges by default', function () {
    $this->withServerVariables(['REMOTE_ADDR' => '172.31.0.5'])
        ->get('/_client-ip', ['X-Forwarded-For' => '203.0.113.9'])
        ->assertSee('203.0.113.9');
});

it('trusts only the configured proxies', function () {
    config(['subs.trusted_proxies' => ['172.31.0.0/24']]);
    app()->getProvider(AppServiceProvider::class)->boot();

    $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.7'])
        ->get('/_client-ip', ['X-Forwarded-For' => '203.0.113.9'])
        ->assertSee('10.0.0.7');
    $this->withServerVariables(['REMOTE_ADDR' => '172.31.0.5'])
        ->get('/_client-ip', ['X-Forwarded-For' => '203.0.113.9'])
        ->assertSee('203.0.113.9');
});
