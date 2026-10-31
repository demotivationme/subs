<?php

use App\Models\Category;
use App\Models\Service;
use Database\Seeders\CatalogSeeder;

it('seeds 12 preset categories and a catalog where every service has a category', function () {
    expect(Category::whereNull('user_id')->count())->toBe(12)
        ->and(Service::whereNull('user_id')->count())->toBeGreaterThanOrEqual(60)
        ->and(Service::whereNull('user_id')->whereNull('default_category_id')->count())->toBe(0);
});

it('is idempotent', function () {
    $this->seed(CatalogSeeder::class);

    expect(Category::whereNull('user_id')->count())->toBe(12)
        ->and(Service::where('slug', 'netflix')->count())->toBe(1);
});

it('labels preset categories by translation key and custom ones by name', function () {
    $custom = Category::factory()->create(['name' => 'Kids']);

    expect(Category::other()->label())->toBe('Other')
        ->and(Category::where('key', 'video_streaming')->first()->label())->toBe('Video Streaming')
        ->and($custom->label())->toBe('Kids')
        ->and($custom->isCustom())->toBeTrue();
});
