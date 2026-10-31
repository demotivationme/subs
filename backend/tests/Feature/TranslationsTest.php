<?php

use Database\Seeders\CategorySeeder;
use Illuminate\Support\Arr;

function langKeys(string $locale): array
{
    $keys = [];
    foreach (glob(lang_path("{$locale}/*.php")) as $file) {
        $group = basename($file, '.php');
        foreach (array_keys(Arr::dot(require $file)) as $key) {
            $keys[] = "{$group}.{$key}";
        }
    }
    sort($keys);

    return $keys;
}

it('has every English key in every supported locale', function (string $locale) {
    expect(array_values(array_diff(langKeys('en'), langKeys($locale))))->toBe([]);
})->with(fn () => (require __DIR__.'/../../config/subs.php')['locales']);

it('has a label for every preset category', function () {
    foreach (array_keys(CategorySeeder::CATEGORIES) as $key) {
        expect(__("categories.{$key}"))->not->toBe("categories.{$key}");
    }
});
