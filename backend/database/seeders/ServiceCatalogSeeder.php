<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Service;
use App\Services\ServiceLogoStorage;
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
        'NordVPN' => 'software_cloud', 'ChatGPT Plus' => 'ai', 'Claude Pro' => 'ai',
        'Notion' => 'software_cloud', 'GitHub Copilot' => 'ai', 'Canva Pro' => 'software_cloud',
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
        'ChatGPT Pro' => 'ai', 'Claude Max' => 'ai', 'Google AI Pro' => 'ai', 'Microsoft Copilot Pro' => 'ai',
        'Midjourney' => 'ai', 'SuperGrok' => 'ai', 'DeepSeek API' => 'ai',
        'Adobe Photoshop' => 'software_cloud', 'Adobe Lightroom' => 'software_cloud', 'Adobe Acrobat Pro' => 'software_cloud',
        'JetBrains All Products Pack' => 'software_cloud', 'IntelliJ IDEA Ultimate' => 'software_cloud',
        'PhpStorm' => 'software_cloud', 'WebStorm' => 'software_cloud', 'PyCharm Professional' => 'software_cloud',
        'GoLand' => 'software_cloud', 'Rider' => 'software_cloud', 'CLion' => 'software_cloud',
        'DataGrip' => 'software_cloud', 'RubyMine' => 'software_cloud',
        'GitHub Pro' => 'software_cloud', 'GitLab Premium' => 'software_cloud', 'Cursor Pro' => 'ai',
        'Windsurf Pro' => 'ai', 'Replit Core' => 'software_cloud', 'Perplexity Pro' => 'ai',
        'Warp' => 'software_cloud', 'Sublime Text' => 'software_cloud', 'Postman' => 'software_cloud',
        'Docker Pro' => 'software_cloud', 'Vercel Pro' => 'software_cloud', 'Netlify Pro' => 'software_cloud',
        'DigitalOcean' => 'software_cloud', 'Heroku' => 'software_cloud', 'Cloudflare' => 'software_cloud',
        'Supabase Pro' => 'software_cloud', 'Railway' => 'software_cloud', 'Render' => 'software_cloud',
        'Fly.io' => 'software_cloud', 'Sentry' => 'software_cloud',
        'Figma Professional' => 'software_cloud', 'Framer' => 'software_cloud', 'Webflow' => 'software_cloud',
        'Linear' => 'software_cloud', 'Jira' => 'software_cloud', 'Trello' => 'software_cloud',
        'Asana' => 'software_cloud', 'ClickUp' => 'software_cloud', 'Miro' => 'software_cloud',
        'Google Workspace' => 'software_cloud', 'Microsoft Teams' => 'software_cloud',
        'Slack Pro' => 'software_cloud', 'Zoom Workplace' => 'software_cloud', 'Raycast Pro' => 'software_cloud',
        'Setapp' => 'software_cloud', 'Obsidian Sync' => 'software_cloud', 'Todoist Pro' => 'software_cloud',
        'Evernote' => 'software_cloud', 'Grammarly Premium' => 'software_cloud',
        'Proton Unlimited' => 'software_cloud', 'ExpressVPN' => 'software_cloud', 'Surfshark' => 'software_cloud',
        'Bitwarden Premium' => 'software_cloud', 'Dashlane' => 'software_cloud', 'LastPass' => 'software_cloud',
    ];

    /**
     * Letter-tile colors for services whose owners had their marks removed from Simple Icons, so we
     * ship no logo for them. Each is dark enough for the app's white letter (3:1 or better).
     */
    public const BRAND_COLORS = [
        'disney' => '#113CCF', 'amazon-prime-video' => '#0F79AF', 'hulu' => '#0B0C0F', 'peacock' => '#000000',
        'amazon-music-unlimited' => '#232F3E', 'deezer' => '#A238FF', 'xbox-game-pass' => '#107C10',
        'nintendo-switch-online' => '#E60012', 'google-one' => '#1A73E8', 'microsoft-365' => '#D83B01',
        'adobe-creative-cloud' => '#DA1F26', 'adobe-photoshop' => '#001E36', 'adobe-lightroom' => '#001E36',
        'adobe-acrobat-pro' => '#B30B00', 'the-economist' => '#E3120B', 'kindle-unlimited' => '#146EB4',
        'calm' => '#2E6BC6', 'myfitnesspal-premium' => '#0066EE', 'masterclass' => '#000000',
        'linkedin-premium' => '#0A66C2', 'amazon-prime' => '#232F3E', 'ynab' => '#3C5FD9',
        'microsoft-copilot-pro' => '#0078D4', 'microsoft-teams' => '#4B53BC',
    ];

    public function run(): void
    {
        $logos = new ServiceLogoStorage;
        $categories = Category::query()->whereNull('user_id')->pluck('id', 'key');

        foreach (self::SERVICES as $name => $categoryKey) {
            $slug = Str::slug($name);
            $attributes = ['name' => $name, 'default_category_id' => $categories[$categoryKey]];

            // Logos are the committed Simple Icons tiles in database/seeders/logos; no file, no logo.
            $file = __DIR__.'/logos/'.$slug.'.svg';
            $attributes['logo_path'] = is_file($file)
                ? $logos->putCatalog($slug, (string) file_get_contents($file))
                : null;
            // A logo carries its own colors; the letter tile needs the brand's.
            $attributes['color'] = $attributes['logo_path'] === null ? (self::BRAND_COLORS[$slug] ?? null) : null;

            Service::query()->updateOrCreate(['user_id' => null, 'slug' => $slug], $attributes);
        }
    }
}
