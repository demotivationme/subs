<?php

namespace App\Models;

use App\Enums\Platform;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeviceToken extends Model
{
    protected $fillable = ['user_id', 'token', 'platform', 'last_seen_at'];

    protected function casts(): array
    {
        return ['platform' => Platform::class, 'last_seen_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
