<?php

namespace App\Providers;

use App\Console\Commands\DispatchReminders;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Events\DiagnosingHealth;
use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
use RuntimeException;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Caddy reaches nginx/php over the Docker network: trust its X-Forwarded-* so the
        // client IP (auth limiter) and https scheme (signed verification links) are real.
        TrustProxies::at(config('subs.trusted_proxies'));

        RateLimiter::for('auth', fn (Request $request) => Limit::perMinute(5)
            ->by(Str::lower(is_string($request->input('email')) ? $request->input('email') : '').'|'.$request->ip()));

        RateLimiter::for('verification', fn (Request $request) => Limit::perMinute(5)
            ->by($request->user()?->id ?: $request->ip()));

        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(120)
            ->by($request->user()?->id ?: $request->ip()));

        ResetPassword::createUrlUsing(fn (User $user, string $token) => config('subs.frontend_url').'/reset-password?'
            .http_build_query(['token' => $token, 'email' => $user->email]));

        Event::listen(DiagnosingHealth::class, function () {
            $last = Cache::get(DispatchReminders::HEARTBEAT_KEY);

            if ($last === null || now()->getTimestamp() - $last > 30 * 60) {
                throw new RuntimeException('The reminder scheduler has not run in the last 30 minutes.');
            }
        });
    }
}
