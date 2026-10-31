<?php

use App\Models\Subscription;

it('returns the dashboard and reflects changes immediately', function () {
    $this->travelTo('2026-10-31 12:00:00');
    $me = actingAsUser(['currency' => 'EUR']);
    Subscription::factory()->for($me)->create(['amount' => 1500]);

    $this->getJson('/api/v1/dashboard')
        ->assertOk()
        ->assertJsonStructure(['currency', 'monthly_total', 'yearly_total', 'count', 'by_category', 'upcoming', 'most_expensive', 'unconverted'])
        ->assertJsonPath('monthly_total', 1500);

    $this->postJson('/api/v1/subscriptions', [
        'service_name' => 'Gym', 'amount' => 500, 'currency' => 'EUR', 'period' => 'month', 'first_payment_date' => '2026-01-10',
    ])->assertCreated();

    $this->getJson('/api/v1/dashboard')->assertJsonPath('monthly_total', 2000)->assertJsonPath('count', 2);
});

it('requires authentication', function () {
    $this->getJson('/api/v1/dashboard')->assertUnauthorized();
});
