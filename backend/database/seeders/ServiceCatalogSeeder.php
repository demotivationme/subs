<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Service;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ServiceCatalogSeeder extends Seeder
{
    public const SERVICES = [
        'Netflix' => 'video_streaming', 'YouTube Premium' => 'video_streaming', 'Disney+' => 'video_streaming',
        'Amazon Prime Video' => 'video_streaming', 'Max' => 'video_streaming', 'Hulu' => 'video_streaming',
        'Apple TV+' => 'video_streaming', 'Paramount+' => 'video_streaming', 'Peacock' => 'video_streaming',
        'Crunchyroll' => 'video_streaming', 'DAZN' => 'video_streaming', 'MUBI' => 'video_streaming',
        'Spotify' => 'music', 'Apple Music' => 'music', 'YouTube Music' => 'music',
        'Amazon Music Unlimited' => 'music', 'Tidal' => 'music', 'Deezer' => 'music', 'SoundCloud Go+' => 'music',
        'Xbox Game Pass' => 'gaming', 'PlayStation Plus' => 'gaming', 'Nintendo Switch Online' => 'gaming',
        'EA Play' => 'gaming', 'Ubisoft+' => 'gaming', 'Apple Arcade' => 'gaming', 'GeForce NOW' => 'gaming',
        'iCloud+' => 'software_cloud', 'Google One' => 'software_cloud', 'Microsoft 365' => 'software_cloud',
        'Dropbox' => 'software_cloud', 'Adobe Creative Cloud' => 'software_cloud', '1Password' => 'software_cloud',
        'NordVPN' => 'software_cloud', 'ChatGPT Plus' => 'software_cloud', 'Claude Pro' => 'software_cloud',
        'Notion' => 'software_cloud', 'GitHub Copilot' => 'software_cloud', 'Canva Pro' => 'software_cloud',
        'The New York Times' => 'news_reading', 'The Washington Post' => 'news_reading', 'The Economist' => 'news_reading',
        'Medium' => 'news_reading', 'Kindle Unlimited' => 'news_reading', 'Audible' => 'news_reading', 'Scribd' => 'news_reading',
        'Strava' => 'fitness_health', 'Peloton' => 'fitness_health', 'Headspace' => 'fitness_health',
        'Calm' => 'fitness_health', 'Fitbit Premium' => 'fitness_health', 'MyFitnessPal Premium' => 'fitness_health',
        'Duolingo Super' => 'education', 'Coursera Plus' => 'education', 'MasterClass' => 'education',
        'LinkedIn Premium' => 'education', 'Skillshare' => 'education',
        'Amazon Prime' => 'shopping_delivery', 'Uber One' => 'shopping_delivery',
        'DoorDash DashPass' => 'shopping_delivery', 'Instacart+' => 'shopping_delivery',
        'Patreon' => 'entertainment', 'Twitch Turbo' => 'entertainment',
        'YNAB' => 'finance',
    ];

    public function run(): void
    {
        $categories = Category::query()->whereNull('user_id')->pluck('id', 'key');

        foreach (self::SERVICES as $name => $categoryKey) {
            Service::query()->updateOrCreate(
                ['user_id' => null, 'slug' => Str::slug($name)],
                ['name' => $name, 'default_category_id' => $categories[$categoryKey]],
            );
        }
    }
}
