<?php

namespace App\Services;

use App\Models\User;
use Closure;
use Illuminate\Support\Facades\Cache;

final class DashboardCache
{
    private const VERSION_KEY = 'dashboard:version';

    public static function remember(User $user, Closure $build): array
    {
        return Cache::remember(self::key($user), now()->addHour(), $build);
    }

    public static function forget(User $user): void
    {
        Cache::forget(self::key($user));
    }

    /** Invalidates every user's dashboard (e.g. after new exchange rates). */
    public static function flushAll(): void
    {
        Cache::forever(self::VERSION_KEY, (int) Cache::get(self::VERSION_KEY, 0) + 1);
    }

    private static function key(User $user): string
    {
        return 'dashboard:'.Cache::get(self::VERSION_KEY, 0).':'.$user->id;
    }
}
