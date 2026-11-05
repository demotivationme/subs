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
    'logo_disk' => env('LOGO_DISK', 'r2'),

    // admin.unsab.com sits behind Cloudflare Access, which sets Cf-Access-Authenticated-User-Email.
    'admin_domain' => env('ADMIN_DOMAIN', 'admin.unsab.com'),
    'admin_emails' => array_values(array_filter(array_map(
        fn (string $email) => strtolower(trim($email)),
        explode(',', (string) env('ADMIN_EMAILS', '')),
    ))),

    // Proxies whose X-Forwarded-* Laravel believes. Production: only the Subs Docker network.
    'trusted_proxies' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('TRUSTED_PROXIES', '10.0.0.0/8,172.16.0.0/12,192.168.0.0/16')),
    ))),

    // Written by the backup container (deploy/backup/backup.sh) through a shared mount.
    // (dirname(__DIR__), not storage_path(): TranslationsTest requires this file before the app exists.)
    'backup_status_file' => env('BACKUP_STATUS_FILE', dirname(__DIR__).'/storage/app/private/backups/status.json'),

    'ecb_url' => 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
];
