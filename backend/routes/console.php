<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('reminders:dispatch')->everyFifteenMinutes()->withoutOverlapping();

// The ECB publishes around 16:00 CET.
Schedule::command('rates:fetch')->dailyAt('16:30')->timezone('Europe/Berlin');
