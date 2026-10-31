<?php

namespace App\Models;

use App\Enums\Channel;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReminderRule extends Model
{
    use HasFactory;

    protected $fillable = ['subscription_id', 'days_before', 'time_of_day', 'channels'];

    protected function casts(): array
    {
        return ['days_before' => 'integer', 'channels' => 'array'];
    }

    /** Postgres returns "09:00:00"; the API speaks "09:00". */
    protected function timeOfDay(): Attribute
    {
        return Attribute::get(fn (?string $value) => $value === null ? null : substr($value, 0, 5));
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }

    public function hasChannel(Channel $channel): bool
    {
        return in_array($channel->value, $this->channels, true);
    }
}
