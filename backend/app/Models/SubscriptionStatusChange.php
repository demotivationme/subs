<?php

namespace App\Models;

use App\Enums\SubscriptionStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriptionStatusChange extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['subscription_id', 'status', 'changed_at'];

    protected function casts(): array
    {
        return ['status' => SubscriptionStatus::class, 'changed_at' => 'immutable_datetime'];
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }
}
