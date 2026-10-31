<?php

namespace App\Models;

use App\Enums\Period;
use App\Enums\SubscriptionStatus;
use App\Services\BillingCycle;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Subscription extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'service_id', 'category_id', 'amount', 'currency', 'period',
        'interval_count', 'first_payment_date', 'status', 'notes',
    ];

    protected $attributes = ['interval_count' => 1, 'status' => 'active'];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'interval_count' => 'integer',
            'period' => Period::class,
            'status' => SubscriptionStatus::class,
            'first_payment_date' => 'immutable_date',
            'next_payment_date' => 'immutable_date',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (Subscription $subscription) {
            if ($subscription->next_payment_date === null
                || $subscription->isDirty(['first_payment_date', 'period', 'interval_count'])) {
                $subscription->next_payment_date = BillingCycle::nextOnOrAfter(
                    $subscription->first_payment_date,
                    $subscription->period,
                    $subscription->interval_count,
                    $subscription->user->today(),
                );
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function reminderRules(): HasMany
    {
        return $this->hasMany(ReminderRule::class);
    }

    /** Own rules replace the user's defaults when present. */
    public function effectiveReminderRules(): Collection
    {
        return $this->reminderRules->isNotEmpty()
            ? $this->reminderRules
            : $this->user->defaultReminderRules;
    }

    public function isOccurrence(CarbonImmutable $date): bool
    {
        return BillingCycle::nextOnOrAfter($this->first_payment_date, $this->period, $this->interval_count, $date)
            ->equalTo($date);
    }
}
