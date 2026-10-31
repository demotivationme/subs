<?php

use App\Models\User;
use App\Notifications\PaymentReminder;
use Illuminate\Support\Str;

function inboxItem(User $user, string $title, ?string $readAt = null, string $createdAt = '2026-10-31 10:00:00'): string
{
    $id = (string) Str::uuid();
    $user->notifications()->create([
        'id' => $id,
        'type' => PaymentReminder::class,
        'data' => ['subscription_id' => 1, 'payment_date' => '2026-11-05', 'days_before' => 1, 'title' => $title, 'body' => '€12.99'],
        'read_at' => $readAt,
        'created_at' => $createdAt,
    ]);

    return $id;
}

it('lists newest first with an unread count', function () {
    $me = actingAsUser();
    inboxItem($me, 'Older', createdAt: '2026-10-30 10:00:00');
    inboxItem($me, 'Newer', readAt: '2026-10-31 11:00:00');

    $this->getJson('/api/v1/notifications')
        ->assertOk()
        ->assertJsonPath('data.0.title', 'Newer')
        ->assertJsonPath('data.1.title', 'Older')
        ->assertJsonPath('data.1.read_at', null)
        ->assertJsonStructure(['meta' => ['current_page', 'last_page']]);

    $this->getJson('/api/v1/notifications/unread-count')->assertExactJson(['count' => 1]);
});

it('marks one or all as read', function () {
    $me = actingAsUser();
    $a = inboxItem($me, 'A');
    inboxItem($me, 'B');

    $this->postJson("/api/v1/notifications/{$a}/read")->assertNoContent();
    $this->getJson('/api/v1/notifications/unread-count')->assertExactJson(['count' => 1]);

    $this->postJson('/api/v1/notifications/read-all')->assertNoContent();
    $this->getJson('/api/v1/notifications/unread-count')->assertExactJson(['count' => 0]);
});

it('cannot read other users notifications', function () {
    actingAsUser();
    $foreign = inboxItem(User::factory()->create(), 'Secret');

    $this->postJson("/api/v1/notifications/{$foreign}/read")->assertNotFound();
});
