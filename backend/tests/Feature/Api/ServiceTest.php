<?php

use App\Models\Category;
use App\Models\Service;
use App\Models\User;

it('searches the catalog case-insensitively', function () {
    actingAsUser();

    $names = collect($this->getJson('/api/v1/services?q=NET')->assertOk()->json('data'))->pluck('name');

    expect($names)->toContain('Netflix');
});

it('hides other users services', function () {
    actingAsUser();
    Service::factory()->create(['user_id' => User::factory()->create()->id, 'name' => 'Secret Gym']);

    expect($this->getJson('/api/v1/services?q=secret')->json('data'))->toBe([]);
});

it('reuses the catalog entry when the typed name matches in any case', function () {
    actingAsUser();
    $netflix = Service::whereNull('user_id')->where('name', 'Netflix')->first();

    $this->postJson('/api/v1/services', ['name' => '  netflix '])
        ->assertOk()
        ->assertJsonPath('data.id', $netflix->id)
        ->assertJsonPath('data.is_custom', false);

    expect(Service::where('name', 'ilike', 'netflix')->count())->toBe(1);
});

it('creates a custom service in Other by default, and reuses it next time', function () {
    $me = actingAsUser();

    $id = $this->postJson('/api/v1/services', ['name' => 'Local Gym'])
        ->assertCreated()
        ->assertJsonPath('data.default_category_id', Category::other()->id)
        ->json('data.id');

    $this->postJson('/api/v1/services', ['name' => 'LOCAL GYM'])->assertOk()->assertJsonPath('data.id', $id);
    expect($me->services()->count())->toBe(1);
});
