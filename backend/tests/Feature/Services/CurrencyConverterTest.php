<?php

use App\Models\ExchangeRate;
use App\Services\CurrencyConverter;

beforeEach(function () {
    ExchangeRate::insert([
        ['date' => '2026-10-29', 'base' => 'EUR', 'quote' => 'USD', 'rate' => 1.00],
        ['date' => '2026-10-30', 'base' => 'EUR', 'quote' => 'USD', 'rate' => 1.25],
        ['date' => '2026-10-30', 'base' => 'EUR', 'quote' => 'JPY', 'rate' => 160],
        ['date' => '2026-10-30', 'base' => 'EUR', 'quote' => 'KWD', 'rate' => 0.5],
    ]);
    $this->converter = app(CurrencyConverter::class);
});

it('returns the same amount for the same currency', function () {
    expect($this->converter->convert(1299, 'EUR', 'EUR'))->toBe(1299.0);
});

it('uses the latest rate per currency', function () {
    // $12.50 at 1.25 = €10.00
    expect($this->converter->convert(1250, 'USD', 'EUR'))->toBe(1000.0);
});

it('respects currencies without two decimals', function () {
    expect($this->converter->convert(1600, 'JPY', 'EUR'))->toBe(1000.0)   // ¥1,600 → €10.00
        ->and($this->converter->convert(1000, 'EUR', 'JPY'))->toBe(1600.0) // €10.00 → ¥1,600
        ->and($this->converter->convert(5000, 'KWD', 'EUR'))->toBe(1000.0); // 5.000 KWD → €10.00
});

it('converts between two non-EUR currencies via EUR', function () {
    expect($this->converter->convert(1250, 'USD', 'JPY'))->toBe(1600.0);
});

it('returns null when a rate is missing', function () {
    expect($this->converter->convert(1000, 'XYZ', 'EUR'))->toBeNull()
        ->and($this->converter->convert(1000, 'EUR', 'XYZ'))->toBeNull();
});

it('takes minor-unit digits from CLDR', function (string $currency, int $digits) {
    expect(CurrencyConverter::decimals($currency))->toBe($digits);
})->with([['XPF', 0], ['LYD', 3], ['EUR', 2], ['JPY', 0], ['KWD', 3]]);
