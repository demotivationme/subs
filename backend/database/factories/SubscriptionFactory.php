<?php

namespace Database\Factories;

use App\Enums\Period;
use App\Models\Category;
use App\Models\Service;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class SubscriptionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'service_id' => Service::factory(),
            'category_id' => fn (array $attributes) => Category::factory()->create(['user_id' => $attributes['user_id']])->id,
            'amount' => 999,
            'currency' => 'EUR',
            'period' => Period::Month,
            'interval_count' => 1,
            'first_payment_date' => '2026-01-15',
            'status' => 'active',
        ];
    }
}
