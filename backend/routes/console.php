<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('reminders:dispatch')->everyFifteenMinutes()->withoutOverlapping(30);

// The ECB publishes around 16:00 CET.
Schedule::command('rates:fetch')->dailyAt('16:30')->timezone('Europe/Berlin');

// Backups only run on the server (the backup container, 03:00 UTC).
Schedule::command('backups:check')->hourlyAt(5)->environments(['production']);
