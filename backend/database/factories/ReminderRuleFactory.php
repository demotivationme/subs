<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class ReminderRuleFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'subscription_id' => null,
            'days_before' => 1,
            'time_of_day' => '09:00',
            'channels' => ['push', 'in_app'],
        ];
    }
}
