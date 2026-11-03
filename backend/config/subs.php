<?php

return [
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:8081'),

    // Add a locale here and create lang/<locale>/ to support a new language.
    'locales' => ['en'],

    // null = unlimited (MVP). Freemium at launch sets a number.
    'free_subscription_limit' => env('FREE_SUBSCRIPTION_LIMIT') ? (int) env('FREE_SUBSCRIPTION_LIMIT') : null,

    'default_reminder' => ['days_before' => 1, 'time_of_day' => '09:00', 'channels' => ['push', 'in_app']],
    'max_reminder_rules' => 5,

    // Disk for service logos (catalog and custom). services.logo_path stores only the path on it,
    // so switching storage providers means copying the files and changing this, not the database.
    'logo_disk' => env('LOGO_DISK', 'public'),

    'ecb_url' => 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
];
