<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Service;
use App\Models\User;

final class ServiceResolver
{
    /** Catalog match first, then the user's own; otherwise a new service owned by the user. */
    public function resolve(User $user, string $name, ?int $defaultCategoryId = null): Service
    {
        $name = trim($name);

        $existing = Service::query()
            ->visibleTo($user)
            ->whereRaw('lower(name) = ?', [mb_strtolower($name)])
            ->orderByRaw('user_id IS NOT NULL')
            ->first();

        return $existing ?? $user->services()->create([
            'name' => $name,
            'default_category_id' => $defaultCategoryId ?? Category::other()->id,
        ]);
    }
}
