<?php

use App\Models\Service;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

beforeEach(fn () => Storage::fake('public'));

function logo(int $w = 256, int $h = 256, string $name = 'logo.png'): UploadedFile
{
    return UploadedFile::fake()->image($name, $w, $h);
}

it('creates a custom service with a color', function () {
    actingAsUser();

    $this->postJson('/api/v1/services', ['name' => 'Local Gym', 'color' => '#A1b2C3'])
        ->assertCreated()
        ->assertJsonPath('data.color', '#A1b2C3');
});

it('rejects an invalid color', function (string $color) {
    actingAsUser();

    $this->postJson('/api/v1/services', ['name' => 'Local Gym', 'color' => $color])->assertUnprocessable();
})->with(['red', '#fff', '#GGGGGG', '123456']);

it('updates the name and color of an own service', function () {
    $me = actingAsUser();
    $service = Service::factory()->create(['user_id' => $me->id, 'name' => 'Gym', 'color' => '#111111']);

    $this->patchJson("/api/v1/services/{$service->id}", ['name' => 'Big Gym', 'color' => '#222222'])
        ->assertOk()
        ->assertJsonPath('data.name', 'Big Gym')
        ->assertJsonPath('data.color', '#222222');

    $this->patchJson("/api/v1/services/{$service->id}", ['color' => null])
        ->assertOk()
        ->assertJsonPath('data.name', 'Big Gym')
        ->assertJsonPath('data.color', null);

    $this->patchJson("/api/v1/services/{$service->id}", ['color' => 'nope'])->assertUnprocessable();
});

it('forbids changing a catalog service and hides other users services', function () {
    actingAsUser();
    $catalog = Service::whereNull('user_id')->where('name', 'Netflix')->first();
    $theirs = Service::factory()->create(['user_id' => User::factory()->create()->id]);

    $this->patchJson("/api/v1/services/{$catalog->id}", ['name' => 'Mine'])->assertForbidden();
    $this->patchJson("/api/v1/services/{$theirs->id}", ['name' => 'Mine'])->assertNotFound();
    expect($catalog->fresh()->name)->toBe('Netflix');
});

it('uploads a logo, replaces it and removes it', function () {
    $me = actingAsUser();
    $service = Service::factory()->create(['user_id' => $me->id]);

    $first = $this->postJson("/api/v1/services/{$service->id}/logo", ['logo' => logo()])->assertOk();
    $firstPath = $service->fresh()->logo_path;
    expect($firstPath)->toStartWith('service-logos/');
    Storage::disk('public')->assertExists($firstPath);
    expect($first->json('data.logo_url'))->toBe(Storage::disk('public')->url($firstPath));

    $this->postJson("/api/v1/services/{$service->id}/logo", ['logo' => logo(128, 128, 'new.jpg')])->assertOk();
    $secondPath = $service->fresh()->logo_path;
    expect($secondPath)->not->toBe($firstPath);
    Storage::disk('public')->assertMissing($firstPath);
    Storage::disk('public')->assertExists($secondPath);

    $this->deleteJson("/api/v1/services/{$service->id}/logo")->assertNoContent();
    Storage::disk('public')->assertMissing($secondPath);
    expect($service->fresh()->logo_path)->toBeNull();
});

it('refuses logo uploads to catalog and other users services', function () {
    actingAsUser();
    $catalog = Service::whereNull('user_id')->first();
    $theirs = Service::factory()->create(['user_id' => User::factory()->create()->id]);

    $this->postJson("/api/v1/services/{$catalog->id}/logo", ['logo' => logo()])->assertForbidden();
    $this->postJson("/api/v1/services/{$theirs->id}/logo", ['logo' => logo()])->assertNotFound();
    $this->deleteJson("/api/v1/services/{$catalog->id}/logo")->assertForbidden();
    $this->deleteJson("/api/v1/services/{$theirs->id}/logo")->assertNotFound();
    expect(Storage::disk('public')->allFiles())->toBe([]);
});

it('rejects bad logo files', function (UploadedFile $file) {
    $me = actingAsUser();
    $service = Service::factory()->create(['user_id' => $me->id]);

    $this->postJson("/api/v1/services/{$service->id}/logo", ['logo' => $file])->assertUnprocessable()->assertJsonValidationErrors('logo');
    expect(Storage::disk('public')->allFiles())->toBe([]);
})->with([
    'not an image' => fn () => UploadedFile::fake()->create('logo.pdf', 10, 'application/pdf'),
    'too small' => fn () => UploadedFile::fake()->image('logo.png', 32, 32),
    'too large in pixels' => fn () => UploadedFile::fake()->image('logo.png', 4000, 100),
    'too heavy' => fn () => UploadedFile::fake()->image('logo.png', 256, 256)->size(3000),
    'wrong type' => fn () => UploadedFile::fake()->image('logo.gif', 256, 256),
]);

it('requires the logo field', function () {
    $me = actingAsUser();
    $service = Service::factory()->create(['user_id' => $me->id]);

    $this->postJson("/api/v1/services/{$service->id}/logo")->assertUnprocessable();
});

it('removes the logo files of a deleted account', function () {
    $user = User::factory()->create(['password' => 'secret-pass-1']);
    $token = $user->createToken('phone')->plainTextToken;
    Storage::disk('public')->put('service-logos/a.png', 'x');
    Storage::disk('public')->put('service-logos/b.png', 'x');
    Storage::disk('public')->put('service-logos/other.png', 'x');
    Service::factory()->create(['user_id' => $user->id, 'logo_path' => 'service-logos/a.png']);
    Service::factory()->create(['user_id' => $user->id, 'logo_path' => 'service-logos/b.png']);
    Service::factory()->create(['user_id' => User::factory()->create()->id, 'logo_path' => 'service-logos/other.png']);

    $this->withToken($token)->deleteJson('/api/v1/me', ['password' => 'secret-pass-1'])->assertNoContent();

    Storage::disk('public')->assertMissing('service-logos/a.png');
    Storage::disk('public')->assertMissing('service-logos/b.png');
    Storage::disk('public')->assertExists('service-logos/other.png');
});

it('returns the service color in the subscriptions list', function () {
    $me = actingAsUser();
    $service = Service::factory()->create(['user_id' => $me->id, 'color' => '#336699']);
    Subscription::factory()->for($me)->create(['service_id' => $service->id]);

    $this->getJson('/api/v1/subscriptions')
        ->assertOk()
        ->assertJsonPath('data.0.service.color', '#336699');
});
