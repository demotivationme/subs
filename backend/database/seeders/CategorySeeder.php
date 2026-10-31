<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    public const CATEGORIES = [
        'entertainment' => ['sparkles', '#F59E0B'],
        'music' => ['musical-notes', '#10B981'],
        'video_streaming' => ['tv', '#EF4444'],
        'gaming' => ['game-controller', '#8B5CF6'],
        'software_cloud' => ['cloud', '#3B82F6'],
        'news_reading' => ['newspaper', '#6B7280'],
        'fitness_health' => ['fitness', '#EC4899'],
        'education' => ['school', '#14B8A6'],
        'utilities_telecom' => ['flash', '#EAB308'],
        'shopping_delivery' => ['cart', '#F97316'],
        'finance' => ['card', '#0EA5E9'],
        'other' => ['ellipsis-horizontal', '#64748B'],
    ];

    public function run(): void
    {
        foreach (self::CATEGORIES as $key => [$icon, $color]) {
            Category::query()->updateOrCreate(
                ['user_id' => null, 'key' => $key],
                ['icon' => $icon, 'color' => $color],
            );
        }
    }
}
