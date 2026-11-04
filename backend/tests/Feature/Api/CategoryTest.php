<?php

use App\Models\Category;
use App\Models\Subscription;
use App\Repositories\CategoryRepository;

it('lists presets plus my own categories only', function () {
    $me = actingAsUser();
    Category::factory()->create(['user_id' => $me->id, 'name' => 'Kids']);
    Category::factory()->create(['name' => 'Someone else']);

    $labels = collect($this->getJson('/api/v1/categories')->assertOk()->json('data'))->pluck('label');

    expect($labels)->toHaveCount(14)->toContain('Kids', 'Other')->not->toContain('Someone else');
});

it('creates, renames and validates a custom category', function () {
    actingAsUser();

    $id = $this->postJson('/api/v1/categories', ['name' => 'Kids', 'color' => '#112233'])
        ->assertCreated()
        ->assertJsonPath('data.is_custom', true)
        ->json('data.id');

    $this->patchJson("/api/v1/categories/{$id}", ['name' => 'Family'])->assertOk()->assertJsonPath('data.label', 'Family');
    $this->postJson('/api/v1/categories', ['name' => '', 'color' => 'red'])->assertJsonValidationErrors(['name', 'color']);
});

it('forbids editing presets and hides other users categories', function () {
    actingAsUser();
    $foreign = Category::factory()->create();

    $this->patchJson('/api/v1/categories/'.app(CategoryRepository::class)->other()->id, ['name' => 'X'])->assertForbidden();
    $this->patchJson("/api/v1/categories/{$foreign->id}", ['name' => 'X'])->assertNotFound();
    $this->deleteJson("/api/v1/categories/{$foreign->id}")->assertNotFound();
});

it('moves subscriptions (including deleted ones) to Other when a category is deleted', function () {
    $me = actingAsUser();
    $kids = Category::factory()->create(['user_id' => $me->id]);
    $active = Subscription::factory()->for($me)->create(['category_id' => $kids->id]);
    $trashed = Subscription::factory()->for($me)->create(['category_id' => $kids->id]);
    $trashed->delete();

    $this->deleteJson("/api/v1/categories/{$kids->id}")->assertNoContent();

    expect($active->fresh()->category_id)->toBe(app(CategoryRepository::class)->other()->id)
        ->and(Subscription::withTrashed()->find($trashed->id)->category_id)->toBe(app(CategoryRepository::class)->other()->id)
        ->and(Category::find($kids->id))->toBeNull();
});

it('returns 404 for a non-numeric category id', function () {
    actingAsUser();

    $this->patchJson('/api/v1/categories/abc', ['name' => 'Kids'])->assertNotFound();
    $this->deleteJson('/api/v1/categories/abc')->assertNotFound();
});
