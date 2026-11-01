<?php

namespace Database\Seeders;

use App\Models\Service;
use App\Models\User;
use App\Repositories\CategoryRepository;
use Illuminate\Database\Seeder;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::query()->updateOrCreate(['email' => 'demo@subs.test'], [
            'name' => 'Demo', 'password' => 'password', 'timezone' => 'Europe/Paris', 'currency' => 'EUR', 'locale' => 'en',
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();

        if ($user->subscriptions()->exists()) {
            return;
        }

        $user->reminderRules()->create(config('subs.default_reminder'));

        $rows = [
            ['Netflix', 1399, 'EUR', 'month', 1, '2026-01-05'],
            ['Spotify', 1199, 'USD', 'month', 1, '2026-02-12'],
            ['iCloud+', 2999, 'EUR', 'year', 1, '2025-11-20'],
            ['Xbox Game Pass', 1499, 'EUR', 'month', 3, '2026-03-01'],
            ['Duolingo Super', 799, 'GBP', 'month', 1, '2026-06-18'],
        ];

        foreach ($rows as [$name, $amount, $currency, $period, $interval, $first]) {
            $service = Service::query()->whereNull('user_id')->where('name', $name)->firstOrFail();
            $user->subscriptions()->create([
                'service_id' => $service->id,
                'category_id' => $service->default_category_id ?? app(CategoryRepository::class)->other()->id,
                'amount' => $amount, 'currency' => $currency, 'period' => $period,
                'interval_count' => $interval, 'first_payment_date' => $first,
            ]);
        }
    }
}
