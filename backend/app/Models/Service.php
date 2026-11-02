<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Service extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'slug', 'logo_path', 'color', 'default_category_id'];

    protected static function booted(): void
    {
        static::creating(function (Service $service) {
            $service->slug ??= Str::slug($service->name);
        });
    }

    public function scopeVisibleTo(Builder $query, User $user): void
    {
        $query->where(fn (Builder $q) => $q->whereNull('user_id')->orWhere('user_id', $user->id));
    }

    public function defaultCategory(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'default_category_id');
    }
}
