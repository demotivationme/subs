<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    use HasFactory;

    protected $fillable = ['user_id', 'key', 'name', 'icon', 'color'];

    public function scopeVisibleTo(Builder $query, User $user): void
    {
        $query->where(fn (Builder $q) => $q->whereNull('user_id')->orWhere('user_id', $user->id));
    }

    public function label(): string
    {
        return $this->key !== null ? __('categories.'.$this->key) : (string) $this->name;
    }

    public function isCustom(): bool
    {
        return $this->user_id !== null;
    }
}
