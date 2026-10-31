<?php

namespace App\Models;

use App\Services\DashboardCache;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Contracts\Translation\HasLocalePreference;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use NotificationChannels\WebPush\HasPushSubscriptions;

class User extends Authenticatable implements HasLocalePreference, MustVerifyEmail
{
    use HasApiTokens, HasFactory, HasPushSubscriptions, Notifiable;

    protected $fillable = ['name', 'email', 'password', 'timezone', 'currency', 'locale'];

    protected $hidden = ['password', 'remember_token'];

    protected static function booted(): void
    {
        static::updated(function (User $user) {
            if ($user->wasChanged(['currency', 'timezone'])) {
                DashboardCache::forget($user);
            }
        });
    }

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_premium' => 'boolean',
        ];
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    public function categories(): HasMany
    {
        return $this->hasMany(Category::class);
    }

    public function services(): HasMany
    {
        return $this->hasMany(Service::class);
    }

    public function reminderRules(): HasMany
    {
        return $this->hasMany(ReminderRule::class);
    }

    public function defaultReminderRules(): HasMany
    {
        return $this->reminderRules()->whereNull('subscription_id');
    }

    public function deviceTokens(): HasMany
    {
        return $this->hasMany(DeviceToken::class);
    }

    public function preferredLocale(): string
    {
        return $this->locale;
    }

    /** The user's local calendar date, as a midnight date comparable with `date` columns. */
    public function today(): CarbonImmutable
    {
        return CarbonImmutable::parse(CarbonImmutable::now($this->timezone)->toDateString());
    }
}
