<?php

use App\Models\Category;
use App\Models\Service;
use App\Models\Subscription;
use App\Models\User;

it('shows and updates the profile', function () {
    actingAsUser(['name' => 'Ana']);

    $this->getJson('/api/v1/me')->assertOk()->assertJsonPath('data.name', 'Ana');
    $this->patchJson('/api/v1/me', ['currency' => 'USD', 'timezone' => 'Asia/Tokyo'])
        ->assertOk()
        ->assertJsonPath('data.currency', 'USD')
        ->assertJsonPath('data.timezone', 'Asia/Tokyo');
});

it('requires the password to delete the account', function () {
    actingAsUser(['password' => 'secret-pass-1']);

    $this->deleteJson('/api/v1/me', ['password' => 'wrong'])->assertUnprocessable();
});

it('deletes the account and all its data', function () {
    $user = actingAsUser(['password' => 'secret-pass-1']);
    $service = Service::factory()->create(['user_id' => $user->id]);
    Subscription::factory()->for($user)->create(['service_id' => $service->id]);
    $user->createToken('phone');

    $this->deleteJson('/api/v1/me', ['password' => 'secret-pass-1'])->assertNoContent();

    expect(User::count())->toBe(0)
        ->and(Subscription::withTrashed()->count())->toBe(0)
        ->and(Category::whereNotNull('user_id')->count())->toBe(0)
        ->and(Service::whereNotNull('user_id')->count())->toBe(0);
});
