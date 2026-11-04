<?php

use App\Models\Category;
use App\Models\Service;
use App\Repositories\CategoryRepository;
use Database\Seeders\CatalogSeeder;

it('seeds 13 preset categories and a catalog where every service has a category', function () {
    expect(Category::whereNull('user_id')->count())->toBe(13)
        ->and(Service::whereNull('user_id')->count())->toBeGreaterThanOrEqual(60)
        ->and(Service::whereNull('user_id')->whereNull('default_category_id')->count())->toBe(0);
});

it('is idempotent', function () {
    $this->seed(CatalogSeeder::class);

    expect(Category::whereNull('user_id')->count())->toBe(13)
        ->and(Service::where('slug', 'netflix')->count())->toBe(1);
});

it('labels preset categories by translation key and custom ones by name', function () {
    $custom = Category::factory()->create(['name' => 'Kids']);

    expect(app(CategoryRepository::class)->other()->label())->toBe('Other')
        ->and(Category::where('key', 'video_streaming')->first()->label())->toBe('Video Streaming')
        ->and($custom->label())->toBe('Kids')
        ->and($custom->isCustom())->toBeTrue();
});

it('gives every catalog service a logo or a brand color that keeps the white letter readable', function () {
    $luminance = function (string $hex): float {
        [$r, $g, $b] = array_map(function (string $pair): float {
            $c = hexdec($pair) / 255;

            return $c <= 0.03928 ? $c / 12.92 : (($c + 0.055) / 1.055) ** 2.4;
        }, str_split(ltrim($hex, '#'), 2));

        return 0.2126 * $r + 0.7152 * $g + 0.0722 * $b;
    };

    foreach (Service::whereNull('user_id')->get() as $service) {
        if ($service->logo_path !== null) {
            expect($service->color)->toBeNull();

            continue;
        }
        expect($service->color)->toMatch('/^#[0-9A-F]{6}$/', "{$service->name} has neither a logo nor a color");
        expect(1.05 / ($luminance($service->color) + 0.05))->toBeGreaterThanOrEqual(3.0, "{$service->name}'s color is too light for a white letter");
    }
});

it('lists JetBrains and the other developer tools under software', function () {
    $software = Category::where('key', 'software_cloud')->first()->id;

    foreach (['phpstorm' => 'PhpStorm', 'jetbrains-all-products-pack' => 'JetBrains All Products Pack', 'github-pro' => 'GitHub Pro', 'figma-professional' => 'Figma Professional', 'adobe-photoshop' => 'Adobe Photoshop'] as $slug => $name) {
        $service = Service::whereNull('user_id')->where('slug', $slug)->first();
        expect($service?->name)->toBe($name)
            ->and($service->default_category_id)->toBe($software);
    }
});

it('groups the AI assistants in their own category', function () {
    $ai = Category::where('key', 'ai')->first();

    expect($ai->label())->toBe('AI')
        ->and(Service::whereNull('user_id')->where('default_category_id', $ai->id)->orderBy('slug')->pluck('slug')->all())
        ->toBe(['chatgpt-plus', 'chatgpt-pro', 'claude-max', 'claude-pro', 'cursor-pro', 'deepseek-api', 'github-copilot',
            'google-ai-pro', 'microsoft-copilot-pro', 'midjourney', 'perplexity-pro', 'supergrok', 'windsurf-pro']);
});
