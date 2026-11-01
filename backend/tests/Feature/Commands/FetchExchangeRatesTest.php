<?php

use App\Models\ExchangeRate;
use App\Services\CurrencyConverter;
use Illuminate\Http\Client\Factory;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Sleep;

beforeEach(function () {
    Http::fake([config('subs.ecb_url') => Http::response(file_get_contents(base_path('tests/Fixtures/ecb-daily.xml')))]);
});

it('stores the daily ECB rates', function () {
    $this->artisan('rates:fetch')->assertSuccessful();

    expect(ExchangeRate::count())->toBe(3)
        ->and(ExchangeRate::where('quote', 'USD')->first())
        ->date->toDateString()->toBe('2026-10-30')
        ->rate->toBe(1.0812);
});

it('does not duplicate rows when run twice on the same day', function () {
    $this->artisan('rates:fetch');
    $this->artisan('rates:fetch');

    expect(ExchangeRate::count())->toBe(3);
});

it('refreshes the cached rates', function () {
    $converter = app(CurrencyConverter::class);
    expect($converter->rate('USD'))->toBeNull();

    $this->artisan('rates:fetch');

    expect((app(CurrencyConverter::class))->rate('USD'))->toBe(1.0812);
});

it('fails loudly when the ECB is down', function () {
    Sleep::fake();
    // R1 adaptation: Http::fake() appends stubs and the first match wins, so the beforeEach 200 stub
    // would shadow this 500 stub. Swap in a fresh factory so only the 500 stub is registered.
    Http::swap(new Factory);
    Http::fake([config('subs.ecb_url') => Http::response('', 500)]);

    $this->artisan('rates:fetch');
})->throws(RequestException::class);
