<?php

use App\Models\Service;
use Database\Seeders\CatalogSeeder;
use Illuminate\Support\Facades\Storage;

beforeEach(fn () => Storage::fake('public'));

it('ships a logo for a covered catalog service', function () {
    $this->seed(CatalogSeeder::class);

    expect(Service::where('slug', 'netflix')->whereNull('user_id')->first()->logo_path)
        ->toBe('service-logos/catalog/netflix.svg');
    Storage::disk('public')->assertExists('service-logos/catalog/netflix.svg');
});

it('leaves an uncovered service without a logo', function () {
    $this->seed(CatalogSeeder::class);

    expect(Service::where('slug', 'disney')->whereNull('user_id')->first()->logo_path)->toBeNull();
    Storage::disk('public')->assertMissing('service-logos/catalog/disney.svg');
});

it('is idempotent and restores changed files', function () {
    $this->seed(CatalogSeeder::class);
    $original = Storage::disk('public')->get('service-logos/catalog/netflix.svg');
    Storage::disk('public')->put('service-logos/catalog/netflix.svg', 'stale');

    $this->seed(CatalogSeeder::class);

    expect(Storage::disk('public')->get('service-logos/catalog/netflix.svg'))->toBe($original)
        ->and(Service::where('slug', 'netflix')->count())->toBe(1);
});

it('never touches user-owned services', function () {
    $mine = Service::factory()->create(['slug' => 'netflix', 'logo_path' => 'service-logos/mine.png']);

    $this->seed(CatalogSeeder::class);

    expect($mine->fresh()->logo_path)->toBe('service-logos/mine.png');
});

it('commits well-formed SVGs with a viewBox', function () {
    $files = glob(database_path('seeders/logos/*.svg'));
    expect($files)->not->toBeEmpty();

    foreach ($files as $file) {
        $xml = simplexml_load_file($file);
        expect($xml)->not->toBeFalse($file)
            ->and((string) $xml['viewBox'])->not->toBe('', $file);
    }
});
