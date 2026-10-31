<?php

return [
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:8081'),

    // Add a locale here and create lang/<locale>/ to support a new language.
    'locales' => ['en'],

    // null = unlimited (MVP). Freemium at launch sets a number.
    'free_subscription_limit' => env('FREE_SUBSCRIPTION_LIMIT') ? (int) env('FREE_SUBSCRIPTION_LIMIT') : null,

    'default_reminder' => ['days_before' => 1, 'time_of_day' => '09:00', 'channels' => ['push', 'in_app']],
    'max_reminder_rules' => 5,

    // ISO 4217 minor-unit exponents that are not 2.
    'currency_decimals' => [
        'BHD' => 3, 'CLP' => 0, 'ISK' => 0, 'JOD' => 3, 'JPY' => 0, 'KRW' => 0, 'KWD' => 3,
        'OMR' => 3, 'PYG' => 0, 'TND' => 3, 'UGX' => 0, 'VND' => 0, 'XAF' => 0, 'XOF' => 0,
    ],

    'ecb_url' => 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
];
